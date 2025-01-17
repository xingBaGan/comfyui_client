export interface WorkflowInput {
    prompt: string;
    negative_prompt?: string;
    seed?: number;
    steps?: number;
    cfg?: number;
    width?: number;
    height?: number;
    batch_size?: number;
}

export interface WorkflowNodeInput {
    [key: string]: any;
}

export interface WorkflowNode {
    class_type?: string;
    inputs: Record<string, any>;
    outputs?: Record<string, any>;
    input_types?: Record<string, any[]>;
    _meta?: Record<string, any>;
}

export interface RawWorkflow {
    [key: string]: WorkflowNode;
}

export interface JobInfo {
    localId: string;
    work: WorkflowInput | RawWorkflow;
    front: boolean;
    remoteId?: string | Promise<string>;
    nodeCount: number;
    sampleCount: number;
}

export interface ClientMessage {
    event: ClientEvent;
    jobId: string;
    value: number;
    error?: string;
}

export enum ClientEvent {
    STARTED = 'started',
    PROGRESS = 'progress',
    COMPLETED = 'completed',
    ERROR = 'error'
}

export interface DeviceInfo {
    type: string;
    name: string;
    total_memory: number;
    free_memory: number;
}

export interface ClientModels {
    nodeInputs?: Record<string, any>;
    resources?: Record<string, any>;
    upscalers?: string[];
}

export interface Progress {
    nodes: number;
    samples: number;
    info: JobInfo;
    
    getValue(): number;
    handle(msg: any): void;
} 