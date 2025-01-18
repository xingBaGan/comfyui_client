import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';
import {
    ClientMessage,
    ClientModels,
    DeviceInfo,
    JobInfo,
    WorkflowInput,
    RawWorkflow,
    ClientEvent
} from './types/index.js';
import { createWorkflow } from './workflow.js';
import EventEmitter from 'events';

// 定义常量
const CONSTANTS = {
    DEFAULT_URL: 'http://127.0.0.1:8188',
    WS_ENDPOINT: '/ws',
    IMAGE_GENERATION_WEIGHT: 0.8,
    NODE_EXECUTION_WEIGHT: 0.2
} as const;

// 定义错误消息
const ERROR_MESSAGES = {
    WEBSOCKET_CONNECTION: 'Could not establish websocket connection',
    UNKNOWN_JOB: 'Received unknown job',
    QUEUE_ERROR: 'Failed to enqueue job',
    ACTIVE_JOB_WARNING: 'Started job %s, but %s was never finished',
    UNEXPECTED_JOB: 'Started job %s, but %s was expected',
    UNKNOWN_MESSAGE: 'Received message for job %s, but job %s is active'
} as const;

export interface ExecutionResult {
    images?: any[];
    outputs?: Record<string, any>;
}

export class ComfyClient extends EventEmitter {
    private url: string;
    private models: ClientModels;
    private readonly clientId: string;
    private active: JobInfo | null = null;
    private jobs: JobInfo[];
    private ws: WebSocket | null;
    private messageQueue: ClientMessage[];
    private isConnected: boolean = false;
    private images: any[] = [];
    private lastImages: any[] = [];
    private progress?: ProgressTracker;
    private outputs: Map<string, ExecutionResult> = new Map();
    private queue: JobInfo[] = [];
    private _deviceInfo!: DeviceInfo;

    constructor(url: string = CONSTANTS.DEFAULT_URL) {
        super();
        this.url = url;
        this.models = {};
        this.clientId = uuidv4();
        this.active = null;
        this.jobs = [];
        this.ws = null;
        this.messageQueue = [];
    }

    /**
     * 连接到ComfyUI服务器
     * @param url 服务器URL
     * @returns Promise<ComfyClient>
     */
    async connect(url: string = CONSTANTS.DEFAULT_URL): Promise<ComfyClient> {
        const client = new ComfyClient(url);
        await this.initializeWebSocket(client);
        this.startListening();
        return client;
    }

    /**
     * 获取系统信息
     * @param client ComfyClient实例
     */
    private async fetchSystemInfo(client: ComfyClient): Promise<void> {
        const systemStats = await client.get('system_stats');
        client.deviceInfo = {
            type: systemStats.devices[0]?.type,
            name: systemStats.devices[0]?.name,
            total_memory: systemStats.devices[0]?.total_memory,
            free_memory: systemStats.devices[0]?.free_memory
        };
    }

    /**
     * 获取节点信息
     * @param client ComfyClient实例
     */
    private async fetchNodeInfo(client: ComfyClient): Promise<void> {
        const nodes = await client.get('object_info');
        client.models.nodeInputs = {};
        Object.keys(nodes).forEach(name => {
            client.models.nodeInputs![name] = nodes[name].input;
        });
    }

    /**
     * 初始化WebSocket连接
     */
    private async initializeWebSocket(client: ComfyClient): Promise<void> {
        const wsUrl = this.getWebSocketUrl();
        try {
            client.ws = new WebSocket(`${wsUrl}${CONSTANTS.WS_ENDPOINT}?clientId=${this.clientId}`);
            this.ws = client.ws;
            await this.waitForWebSocketConnection();
        } catch (e) {
            throw new Error(`${ERROR_MESSAGES.WEBSOCKET_CONNECTION} at ${wsUrl}: ${e}`);
        }
    }

    /**
     * 等待WebSocket连接建立
     */
    private async waitForWebSocketConnection(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.ws!.on('open', () => {
                this.isConnected = true;
                resolve();
            });
            this.ws!.on('error', reject);
        });
    }

    private getWebSocketUrl(): string {
        return this.url.replace('http', 'ws');
    }

    getIsConnected(): boolean {
        return this.isConnected;
    }

    /**
     * 将工作流添加到队列
     * @param work 工作流输入或原始工作流
     * @param front 是否添加到队列前端
     * @returns Promise<string> 本地任务ID
     */
    async enqueue(work: WorkflowInput | RawWorkflow, front: boolean = false): Promise<string> {
        const job: JobInfo = {
            localId: uuidv4(),
            work,
            front,
            nodeCount: 0,
            sampleCount: 0
        };

        const data = {
            prompt: 'prompt' in work ? createWorkflow(work as WorkflowInput, this.models).root : work,
            client_id: this.clientId,
            front
        };

        try {
            const result = await this.post('prompt', data);
            job.remoteId = result.prompt_id;
            this.jobs.push(job);
            this.queue.push(job);
            return job.localId;
        } catch (e) {
            throw new Error(`${ERROR_MESSAGES.QUEUE_ERROR}: ${e}`);
        }
    }

    private startListening(): void {
        if (!this.ws) return;
        this.ws.onmessage = async (event) => {
            try {
                const message = event.data.toString();
                await this.handleMessage(message);
            } catch (e) {
                console.error('Error handling message:', e);
            }
        };

        this.ws.on('close', () => {
            this.isConnected = false;
            console.log('WebSocket connection closed');
        });

        this.ws.on('error', (wsError: Error) => {
            console.error('WebSocket error:', wsError);
        });
    }

    private async handleMessage(message: any): Promise<void> {
        this.handleWebSocketMessage(message);
    }

    /**
     * 处理WebSocket消息
     */
    private handleWebSocketMessage(msg: any) {
        if (typeof msg === 'string') {
            const data = JSON.parse(msg);
            this.handleMessageByType(data);
        } else if (msg instanceof ArrayBuffer) {
            this.images.push(msg);
        }
    }

    /**
     * 根据消息类型处理不同的消息
     */
    private handleMessageByType(data: any) {
        const self = this;
        const handlers: Record<string, (data: any) => void> = {
            status: () => { },
            execution_start: function (data) { self.handleExecutionStart(data) },
            executing: function (data) { self.handleExecuting(data) },
            progress: function (data) { self.handleProgress(data) },
            executed: function (data) { self.handleExecuted(data) },
            execution_error: function (data) { self.handleExecutionError(data) },
            execution_interrupted: function (data) { self.handleExecutionInterrupted(data) },
            etn_workflow_published: function (data) { self.handleWorkflowPublished(data) }
        };
        const handler = handlers[data.type];
        if (handler) {
            handler(data.data);
        }
    }

    private async startJob(remoteId: string): Promise<JobInfo | undefined> {
        console.log(`--------------------${remoteId}--------------------`);
        if (this.active !== null) {
            console.warn(`Started job ${remoteId}, but ${this.active} was never finished`);
        }
        if (this.jobs.length === 0) {
            console.warn(`Received unknown job ${remoteId}`);
            return undefined;
        }
        // 检查队列中的第一个任务
        const firstJob = this.jobs[0];
        if (firstJob.remoteId === remoteId) {
            this.jobs.shift(); // 移除第一个任务
            return firstJob;
        }

        console.warn(`Started job ${remoteId}, but ${firstJob} was expected`);
        // 在所有任务中查找匹配的任务
        const job = this.jobs.find(j => j.remoteId === remoteId);
        if (job) {
            this.jobs = this.jobs.filter(j => j !== job); // 从队列中移除该任务
            return job;
        }
        return undefined;
    }

    private clearJob(remoteId: string): string | undefined {
        if (this.active && this.active.remoteId === remoteId) {
            const localId = this.active.localId;
            this.active = null;
            return localId;
        }
        return undefined;
    }

    /**
     * 中断当前执行的任务
     */
    async interrupt(): Promise<void> {
        await this.post('interrupt', {});
    }

    /**
     * 清空任务队列
     */
    async clearQueue(): Promise<void> {
        // 清空等待队列中的任务
        while (this.queue.length > 0) {
            const job = this.queue.shift();
            if (job) {
                this.emit(ClientEvent.Interrupted, job.localId);
            }
        }

        // 清空服务器端队列
        await this.post('queue', { clear: true });
        this.jobs = [];
    }

    /**
     * 获取指定任务的执行结果
     * @param jobId 任务ID
     * @returns ExecutionResult | undefined
     */
    getResult(jobId: string): ExecutionResult | undefined {
        return this.outputs.get(jobId);
    }

    /**
     * 清除指定任务的执行结果
     * @param jobId 任务ID
     */
    private clearResult(jobId: string): void {
        this.outputs.delete(jobId);
    }

    /**
     * 断开与服务器的连接
     */
    async disconnect(): Promise<void> {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
        this.active = null;
        this.jobs = [];
        this.outputs.clear();
    }

    get deviceInfo(): DeviceInfo {
        return this._deviceInfo;
    }

    set deviceInfo(value: DeviceInfo) {
        this._deviceInfo = value;
    }

    private getActiveJob(remoteId: string): JobInfo | undefined {
        if (this.active && this.active.remoteId === remoteId) {
            return this.active;
        } else if (this.active) {
            console.warn(`Received message for job ${remoteId}, but job ${this.active} is active`);
        }
        if (this.jobs.length === 0) {
            console.warn(`Received unknown job ${remoteId}`);
            return undefined;
        }
        const active = this.jobs.find(j => j.remoteId === remoteId);
        if (active) {
            return active;
        }
        return undefined;
    }

    private findJobByRemoteId(remoteId: string): JobInfo | undefined {
        return this.jobs.find(job => job.remoteId === remoteId);
    }

    private handleExecutionStart(data: any) {
        const id = data.prompt_id;
        this.startJob(id).then(job => {
            if (job) {
                this.active = job;
                this.progress = new ProgressTracker(job);
                this.images = [];
                this.emit(ClientEvent.STARTED, job.localId);
            }
        });
    }

    private handleExecuting(data: any) {
        if (data.node === null) {
            const jobId = data.prompt_id;
            const activeJob = this.getActiveJob(jobId);
            if (activeJob && typeof jobId === 'string') {
                const localId = activeJob.localId;
                this.clearJob(jobId);
                if (this.images.length === 0) {
                    this.images = this.lastImages;
                }
                const result: ExecutionResult = {
                    images: this.images,
                    outputs: data.output
                };
                this.outputs.set(localId, result);
                if (this.images.length === 0) {
                    this.emit(ClientEvent.Error, localId,
                        "No new images were generated because the inputs did not change.");
                } else {
                    this.lastImages = this.images;
                    this.emit(ClientEvent.Finished, localId, result);
                }
            }
        }
    }

    private handleProgress(data: any) {
        if (this.active && this.progress) {
            this.progress.handle(data);
            this.emit(ClientEvent.Progress, this.active.localId,
                this.progress.getValue());
        }
    }

    private handleExecuted(data: any) {
        if (this.active && this.active.remoteId) {
            const message: ClientMessage = {
                event: ClientEvent.COMPLETED,
                jobId: this.active.localId,
                value: 1
            };
            this.messageQueue.push(message);
            // 保存执行结果
            const result: ExecutionResult = {
                images: [...this.images],
                outputs: data.output
            };
            this.outputs.set(this.active.localId, result);
            this.emit(ClientEvent.COMPLETED, this.active.localId, result);
            if (typeof this.active.remoteId === 'string') {
                this.clearJob(this.active.remoteId);
            }
        }
    }

    private handleExecutionError(data: any) {
        const errorJob = this.getActiveJob(data.prompt_id);
        if (errorJob && typeof errorJob.remoteId === 'string') {
            const error = data.exception_message || 'execution_error';
            const message: ClientMessage = {
                event: ClientEvent.Error,
                jobId: errorJob.localId,
                value: 0,
                error
            };
            this.messageQueue.push(message);
            this.clearJob(errorJob.remoteId);
            this.emit(ClientEvent.Error, errorJob.localId, error);
        }
    }

    private handleExecutionInterrupted(data: any) {
        const job = this.getActiveJob(data.prompt_id);
        if (job && typeof job.remoteId === 'string') {
            this.clearJob(job.remoteId);
            this.emit(ClientEvent.Interrupted, job.localId);
        }
    }

    private handleWorkflowPublished(data: any) {
        const publisher = data.data.publisher;
        const name = `${publisher.name} (${publisher.id})`;
        this.emit(ClientEvent.Published, '', {
            name,
            workflow: data.data.workflow
        });
    }

    /**
     * 发送GET请求
     * @param endpoint 接口端点
     * @returns Promise<any>
     */
    private async get(endpoint: string): Promise<any> {
        const response = await fetch(`${this.url}/${endpoint}`);
        return response.json();
    }

    /**
     * 发送POST请求
     * @param endpoint 接口端点
     * @param data 请求数据
     * @returns Promise<any>
     */
    private async post(endpoint: string, data: any): Promise<any> {
        const response = await fetch(`${this.url}/${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
        return response.json();
    }
}

class ProgressTracker {
    private nodes: number = 0;
    private samples: number = 0;
    private info: JobInfo;

    constructor(jobInfo: JobInfo) {
        this.info = jobInfo;
    }

    /**
     * 处理进度消息
     * @param msg 进度消息
     */
    handle(msg: any): void {
        if (msg.type === 'executing') {
            this.nodes += 1;
        } else if (msg.type === 'execution_cached') {
            this.nodes += msg.data.nodes.length;
        } else if (msg.type === 'progress') {
            this.samples += 1;
        }
    }

    /**
     * 获取当前进度值
     * @returns 进度值 (0-1)
     */
    getValue(): number {
        const nodePart = this.nodes / (this.info.nodeCount + 1);
        const samplePart = this.samples / Math.max(this.info.sampleCount, 1);
        return CONSTANTS.NODE_EXECUTION_WEIGHT * nodePart +
            CONSTANTS.IMAGE_GENERATION_WEIGHT * samplePart;
    }
} 