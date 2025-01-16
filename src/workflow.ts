import { WorkflowInput, ClientModels } from './types/index.js';

interface WorkflowNode {
    class_type: string;
    inputs: Record<string, any>;
}

interface Workflow {
    root: Record<string, WorkflowNode>;
    node_count: number;
    sample_count: number;
}

export function createWorkflow(input: WorkflowInput, models: ClientModels): Workflow {
    if (!input.prompt) {
        throw new Error('Prompt is required');
    }

    const workflow: Workflow = {
        root: {},
        node_count: 4, // 基本工作流包含4个节点
        sample_count: input.batch_size || 1
    };

    // 创建正向提示词编码节点
    workflow.root['1'] = {
        class_type: 'CLIPTextEncode',
        inputs: {
            text: input.prompt,
            clip: models.nodeInputs?.CLIPTextEncode?.required?.clip?.[0] || 'clip'
        }
    };

    // 创建负向提示词编码节点
    workflow.root['2'] = {
        class_type: 'CLIPTextEncode',
        inputs: {
            text: input.negative_prompt || '',
            clip: models.nodeInputs?.CLIPTextEncode?.required?.clip?.[0] || 'clip'
        }
    };

    // 创建采样器节点
    const samplerDefaults = models.nodeInputs?.KSampler?.required || {};
    workflow.root['3'] = {
        class_type: 'KSampler',
        inputs: {
            seed: input.seed ?? samplerDefaults.seed?.[1]?.default ?? 0,
            steps: input.steps ?? samplerDefaults.steps?.[1]?.default ?? 20,
            cfg: input.cfg ?? samplerDefaults.cfg?.[1]?.default ?? 7.0,
            sampler_name: samplerDefaults.sampler_name?.[1]?.default ?? 'euler_a',
            scheduler: samplerDefaults.scheduler?.[1]?.default ?? 'normal',
            denoise: samplerDefaults.denoise?.[1]?.default ?? 1.0,
            model: samplerDefaults.model?.[0] ?? 'model',
            positive: ['1', 0], // 连接到正向提示词节点
            negative: ['2', 0]  // 连接到负向提示词节点
        }
    };

    // 创建空白潜空间图像节点
    const latentDefaults = models.nodeInputs?.EmptyLatentImage?.required || {};
    workflow.root['4'] = {
        class_type: 'EmptyLatentImage',
        inputs: {
            width: input.width ?? latentDefaults.width?.[1]?.default ?? 512,
            height: input.height ?? latentDefaults.height?.[1]?.default ?? 512,
            batch_size: input.batch_size ?? latentDefaults.batch_size?.[1]?.default ?? 1
        }
    };

    return workflow;
} 