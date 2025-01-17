import { createWorkflow } from '../workflow.js';
import { WorkflowInput } from '../types/index.js';

describe('Workflow', () => {
    const defaultModels = {
        nodeInputs: {
            'KSampler': {
                required: {
                    seed: ['INT', { default: 0 }],
                    steps: ['INT', { default: 20 }],
                    cfg: ['FLOAT', { default: 7.0 }],
                    sampler_name: ['STRING', { default: 'euler_a' }],
                    scheduler: ['STRING', { default: 'normal' }],
                    denoise: ['FLOAT', { default: 1.0 }],
                    model: ['MODEL'],
                    positive: ['CONDITIONING'],
                    negative: ['CONDITIONING']
                }
            },
            'CLIPTextEncode': {
                required: {
                    text: ['STRING'],
                    clip: ['CLIP']
                }
            },
            'EmptyLatentImage': {
                required: {
                    width: ['INT', { default: 512 }],
                    height: ['INT', { default: 512 }],
                    batch_size: ['INT', { default: 1 }]
                }
            }
        }
    };

    it('should create a basic text-to-image workflow', () => {
        const input: WorkflowInput = {
            prompt: 'a beautiful landscape',
            negative_prompt: 'ugly, blurry',
            width: 768,
            height: 512,
            steps: 30,
            cfg: 7.5,
            seed: 12345
        };

        const workflow = createWorkflow(input, defaultModels);
        
        expect(workflow).toBeDefined();
        expect(workflow.root).toHaveProperty('3'); // KSampler node
        expect(workflow.root).toHaveProperty('1'); // Positive CLIP
        expect(workflow.root).toHaveProperty('2'); // Negative CLIP
        expect(workflow.root).toHaveProperty('4'); // Empty Latent Image

        // 验证正向提示词编码节点
        expect(workflow.root['1'].class_type).toBe('CLIPTextEncode');
        expect(workflow.root['1'].inputs.text).toBe(input.prompt);

        // 验证负向提示词编码节点
        expect(workflow.root['2'].class_type).toBe('CLIPTextEncode');
        expect(workflow.root['2'].inputs.text).toBe(input.negative_prompt);

        // 验证采样器节点
        expect(workflow.root['3'].class_type).toBe('KSampler');
        expect(workflow.root['3'].inputs.seed).toBe(input.seed);
        expect(workflow.root['3'].inputs.steps).toBe(input.steps);
        expect(workflow.root['3'].inputs.cfg).toBe(input.cfg);

        // 验证空白潜空间图像节点
        expect(workflow.root['4'].class_type).toBe('EmptyLatentImage');
        expect(workflow.root['4'].inputs.width).toBe(input.width);
        expect(workflow.root['4'].inputs.height).toBe(input.height);
    });

    it('should use default values when optional parameters are not provided', () => {
        const input: WorkflowInput = {
            prompt: 'a simple test'
        };

        const workflow = createWorkflow(input, defaultModels);
        
        expect(workflow).toBeDefined();
        
        // 验证使用了默认值
        const sampler = workflow.root['3'];
        expect(sampler.inputs.steps).toBe(20); // 默认步数
        expect(sampler.inputs.cfg).toBe(7.0); // 默认CFG
        expect(sampler.inputs.sampler_name).toBe('euler_a'); // 默认采样器
        
        const latent = workflow.root['4'];
        expect(latent.inputs.width).toBe(512); // 默认宽度
        expect(latent.inputs.height).toBe(512); // 默认高度
        expect(latent.inputs.batch_size).toBe(1); // 默认批次大小
    });

    it('should handle invalid input gracefully', () => {
        const input = {} as WorkflowInput;
        
        expect(() => createWorkflow(input, defaultModels)).toThrow();
    });
}); 