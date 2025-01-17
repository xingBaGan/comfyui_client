import { RawWorkflow } from './index.js';

export enum WorkflowSource {
    Document = 'document',
    Remote = 'remote',
    Local = 'local'
}

export interface CustomWorkflow {
    id: string;
    source: WorkflowSource;
    workflow: RawWorkflow;
    path?: string;
}

export enum ParamKind {
    ImageLayer = 'image_layer',
    MaskLayer = 'mask_layer',
    NumberInt = 'number_int',
    NumberFloat = 'number_float',
    Toggle = 'toggle',
    Text = 'text',
    PromptPositive = 'prompt_positive',
    PromptNegative = 'prompt_negative',
    Choice = 'choice',
    Style = 'style'
}

export interface CustomParam {
    kind: ParamKind;
    name: string;
    default?: any;
    min?: number;
    max?: number;
    choices?: string[];
    displayName: string;
    group: string;
}

export interface WorkflowNode {
    type: string;
    inputs: Record<string, any>;
    outputs?: Record<string, any>;
    _meta?: Record<string, any>;
} 