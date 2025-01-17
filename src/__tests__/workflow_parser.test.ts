import { describe, expect, it } from '@jest/globals';
import { extractWorkflowParameters } from '../workflow_parser.js';
import { ParamKind } from '../types/workflow.js';
import { RawWorkflow } from '../types/index.js';

describe('workflow_parser', () => {
    describe('extractWorkflowParameters', () => {
        it('should extract number parameters', () => {
            const workflow: RawWorkflow = {
                'node1': {
                    class_type: 'Parameter',
                    inputs: {
                        type: 'number (integer)',
                        name: 'test/1. Integer Param',
                        default: 42,
                        min: 1,
                        max: 100
                    }
                },
                'node2': {
                    class_type: 'Parameter',
                    inputs: {
                        type: 'number',
                        name: 'test/2. Float Param',
                        default: 0.5,
                        min: 0.0,
                        max: 1.0
                    }
                }
            };

            const params = extractWorkflowParameters(workflow);
            expect(params).toHaveLength(2);

            expect(params[0]).toEqual({
                kind: ParamKind.NumberInt,
                name: 'test/1. Integer Param',
                default: 42,
                min: 1,
                max: 100,
                displayName: 'Integer Param',
                group: 'test'
            });

            expect(params[1]).toEqual({
                kind: ParamKind.NumberFloat,
                name: 'test/2. Float Param',
                default: 0.5,
                min: 0.0,
                max: 1.0,
                displayName: 'Float Param',
                group: 'test'
            });
        });

        it('should extract text and toggle parameters', () => {
            const workflow: RawWorkflow = {
                'node1': {
                    class_type: 'Parameter',
                    inputs: {
                        type: 'text',
                        name: 'test/1. Text Param',
                        default: 'hello'
                    }
                },
                'node2': {
                    class_type: 'Parameter',
                    inputs: {
                        type: 'toggle',
                        name: 'test/2. Toggle Param',
                        default: true
                    }
                }
            };

            const params = extractWorkflowParameters(workflow);
            expect(params).toHaveLength(2);

            expect(params[0]).toEqual({
                kind: ParamKind.Text,
                name: 'test/1. Text Param',
                default: 'hello',
                displayName: 'Text Param',
                group: 'test'
            });

            expect(params[1]).toEqual({
                kind: ParamKind.Toggle,
                name: 'test/2. Toggle Param',
                default: true,
                displayName: 'Toggle Param',
                group: 'test'
            });
        });

        it('should extract prompt parameters', () => {
            const workflow: RawWorkflow = {
                'node1': {
                    class_type: 'Parameter',
                    inputs: {
                        type: 'prompt (positive)',
                        name: 'test/1. Positive Prompt',
                        default: 'beautiful landscape'
                    }
                },
                'node2': {
                    class_type: 'Parameter',
                    inputs: {
                        type: 'prompt (negative)',
                        name: 'test/2. Negative Prompt',
                        default: 'ugly, blurry'
                    }
                }
            };

            const params = extractWorkflowParameters(workflow);
            expect(params).toHaveLength(2);

            expect(params[0]).toEqual({
                kind: ParamKind.PromptPositive,
                name: 'test/1. Positive Prompt',
                default: 'beautiful landscape',
                displayName: 'Positive Prompt',
                group: 'test'
            });

            expect(params[1]).toEqual({
                kind: ParamKind.PromptNegative,
                name: 'test/2. Negative Prompt',
                default: 'ugly, blurry',
                displayName: 'Negative Prompt',
                group: 'test'
            });
        });

        it('should extract choice parameters', () => {
            const workflow: RawWorkflow = {
                'node1': {
                    class_type: 'Parameter',
                    inputs: {
                        type: 'choice',
                        name: 'test/1. Choice Param',
                        default: 'option1'
                    },
                    outputs: {
                        'output': [['node2', 'input1']]
                    }
                },
                'node2': {
                    class_type: 'SomeNode',
                    inputs: {},
                    input_types: {
                        'input1': [['option1', 'option2', 'option3']]
                    }
                }
            };

            const params = extractWorkflowParameters(workflow);
            expect(params).toHaveLength(1);

            expect(params[0]).toEqual({
                kind: ParamKind.Choice,
                name: 'test/1. Choice Param',
                default: 'option1',
                choices: ['option1', 'option2', 'option3'],
                displayName: 'Choice Param',
                group: 'test'
            });
        });

        it('should handle parameters without group', () => {
            const workflow: RawWorkflow = {
                'node1': {
                    class_type: 'Parameter',
                    inputs: {
                        type: 'text',
                        name: 'Simple Text',
                        default: 'hello'
                    }
                }
            };

            const params = extractWorkflowParameters(workflow);
            expect(params).toHaveLength(1);

            expect(params[0]).toEqual({
                kind: ParamKind.Text,
                name: 'Simple Text',
                default: 'hello',
                displayName: 'Simple Text',
                group: ''
            });
        });

        it('should handle parameters with order numbers', () => {
            const workflow: RawWorkflow = {
                'node1': {
                    class_type: 'Parameter',
                    inputs: {
                        type: 'text',
                        name: '2. Second',
                        default: 'second'
                    }
                },
                'node2': {
                    class_type: 'Parameter',
                    inputs: {
                        type: 'text',
                        name: '1. First',
                        default: 'first'
                    }
                }
            };

            const params = extractWorkflowParameters(workflow);
            expect(params).toHaveLength(2);

            expect(params[1].displayName).toBe('First');
            expect(params[0].displayName).toBe('Second');
        });

        it('should extract Krita specific parameters', () => {
            const workflow: RawWorkflow = {
                'node1': {
                    class_type: 'ETN_KritaStyle',
                    inputs: {
                        name: 'test/1. Style Param',
                        sampler_preset: 'euler_a'
                    }
                },
                'node2': {
                    class_type: 'ETN_KritaImageLayer',
                    inputs: {
                        name: 'test/2. Image Layer'
                    }
                },
                'node3': {
                    class_type: 'ETN_KritaMaskLayer',
                    inputs: {
                        name: 'test/3. Mask Layer'
                    }
                }
            };

            const params = extractWorkflowParameters(workflow);
            expect(params).toHaveLength(3);

            expect(params[0]).toEqual({
                kind: ParamKind.Style,
                name: 'test/1. Style Param',
                default: 'euler_a',
                displayName: 'Style Param',
                group: 'test'
            });

            expect(params[1]).toEqual({
                kind: ParamKind.ImageLayer,
                name: 'test/2. Image Layer',
                displayName: 'Image Layer',
                group: 'test'
            });

            expect(params[2]).toEqual({
                kind: ParamKind.MaskLayer,
                name: 'test/3. Mask Layer',
                displayName: 'Mask Layer',
                group: 'test'
            });
        });
    });
}); 