import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';
import {
    ClientEvent,
    ClientMessage,
    ClientModels,
    DeviceInfo,
    JobInfo,
    Progress,
    WorkflowInput,
    RawWorkflow
} from './types/index.js';
import { createWorkflow } from './workflow.js';

export class ComfyClient {
    private static readonly DEFAULT_URL = 'http://127.0.0.1:8188';
    private url: string;
    private models: ClientModels;
    private clientId: string;
    private active: JobInfo | null;
    private jobs: JobInfo[];
    private ws: WebSocket | null;
    private messageQueue: ClientMessage[];
    private isConnected: boolean;

    constructor(url: string = ComfyClient.DEFAULT_URL) {
        this.url = url;
        this.models = {};
        this.clientId = uuidv4();
        this.active = null;
        this.jobs = [];
        this.ws = null;
        this.messageQueue = [];
        this.isConnected = false;
    }

    async connect(url: string = ComfyClient.DEFAULT_URL): Promise<ComfyClient> {
        const client = new ComfyClient(url);
        console.log(`Connecting to ${client.url}`);

        // 获取系统信息
        const systemStats = await client.get('system_stats');
        client.deviceInfo = {
            type: systemStats.devices[0]?.type,
            name: systemStats.devices[0]?.name,
            total_memory: systemStats.devices[0]?.total_memory,
            free_memory: systemStats.devices[0]?.free_memory
        };

        // 建立WebSocket连接
        const wsUrl = client.getWebSocketUrl();
        try {
            client.ws = new WebSocket(`${wsUrl}/ws?clientId=${client.clientId}`);
            await new Promise((resolve, reject) => {
                client.ws!.on('open', resolve);
                client.ws!.on('error', reject);
            });
        } catch (e) {
            throw new Error(`Could not establish websocket connection at ${wsUrl}: ${e}`);
        }

        // 获取节点信息
        const nodes = await client.get('object_info');
        client.models.nodeInputs = {};
        Object.keys(nodes).forEach(name => {
            client.models.nodeInputs![name] = nodes[name].input;
        });

        client.isConnected = true;
        client.startListening();

        return client;
    }

    private getWebSocketUrl(): string {
        return this.url.replace('http', 'ws');
    }

    private async get(endpoint: string): Promise<any> {
        const response = await fetch(`${this.url}/${endpoint}`);
        return response.json();
    }

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
            return job.localId;
        } catch (e) {
            throw new Error(`Failed to enqueue job: ${e}`);
        }
    }

    private startListening(): void {
        if (!this.ws) return;

        this.ws.on('message', async (data: WebSocket.Data) => {
            try {
                const message = JSON.parse(data.toString());
                await this.handleMessage(message);
            } catch (e) {
                console.error('Error handling message:', e);
            }
        });

        this.ws.on('close', () => {
            this.isConnected = false;
            console.log('WebSocket connection closed');
        });

        this.ws.on('error', (wsError: Error) => {
            console.error('WebSocket error:', wsError);
        });
    }

    private async handleMessage(message: any): Promise<void> {
        const { type, data } = message;

        switch (type) {
            case 'executing':
                await this.handleExecuting(data);
                break;
            case 'progress':
                await this.handleProgress(data);
                break;
            case 'executed':
                await this.handleExecuted(data);
                break;
            case 'execution_error':
                await this.handleError(data);
                break;
        }
    }

    private async handleExecuting(data: any): Promise<void> {
        const job = this.findJobByRemoteId(data.prompt_id);
        if (job) {
            this.active = job;
            await this.reportProgress(ClientEvent.STARTED, job.localId);
        }
    }

    private async handleProgress(data: any): Promise<void> {
        if (this.active) {
            const progress = new ProgressTracker(this.active);
            progress.handle(data);
            await this.reportProgress(ClientEvent.PROGRESS, this.active.localId, progress.getValue());
        }
    }

    private async handleExecuted(data: any): Promise<void> {
        if (this.active && this.active.remoteId) {
            await this.reportProgress(ClientEvent.COMPLETED, this.active.localId, 1);
            this.clearJob(this.active.remoteId);
        }
    }

    private async handleError(data: any): Promise<void> {
        if (this.active && this.active.remoteId) {
            await this.reportProgress(ClientEvent.ERROR, this.active.localId, 0, data.error || 'Unknown error');
            this.clearJob(this.active.remoteId);
        }
    }

    private findJobByRemoteId(remoteId: string): JobInfo | undefined {
        return this.jobs.find(job => job.remoteId === remoteId);
    }

    private clearJob(remoteId: string | Promise<string>): void {
        this.jobs = this.jobs.filter(job => job.remoteId !== remoteId);
        if (this.active?.remoteId === remoteId) {
            this.active = null;
        }
    }

    private async reportProgress(
        event: ClientEvent,
        jobId: string,
        value: number = 0,
        error?: string
    ): Promise<void> {
        const message: ClientMessage = { event, jobId, value, error };
        this.messageQueue.push(message);
    }

    async disconnect(): Promise<void> {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
        this.active = null;
        this.jobs = [];
    }

    get deviceInfo(): DeviceInfo {
        return this._deviceInfo;
    }

    set deviceInfo(value: DeviceInfo) {
        this._deviceInfo = value;
    }

    private _deviceInfo!: DeviceInfo;
}

class ProgressTracker implements Progress {
    nodes: number = 0;
    samples: number = 0;
    info: JobInfo;

    constructor(jobInfo: JobInfo) {
        this.info = jobInfo;
    }

    handle(msg: any): void {
        if (msg.type === 'executing') {
            this.nodes += 1;
        } else if (msg.type === 'execution_cached') {
            this.nodes += msg.data.nodes.length;
        } else if (msg.type === 'progress') {
            this.samples += 1;
        }
    }

    getValue(): number {
        const nodePart = this.nodes / (this.info.nodeCount + 1);
        const samplePart = this.samples / Math.max(this.info.sampleCount, 1);
        return 0.2 * nodePart + 0.8 * samplePart;
    }
} 