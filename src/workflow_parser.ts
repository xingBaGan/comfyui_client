import { RawWorkflow } from './types/index.js';
import { CustomParam, ParamKind } from './types/workflow.js';

function splitName(name: string): [string, string] {
    if (name.includes('/')) {
        const [group, paramName] = name.split('/', 2);
        return [group, paramName];
    }
    return ['', name];
}

function splitOrder(s: string): [number, string] {
    const match = s.match(/^(\d+)\. /);
    if (match) {
        return [parseInt(match[1]), s.substring(match[0].length).trim()];
    }
    return [0, s];
}

function getDisplayName(name: string): string {
    const [, paramName] = splitName(name);
    const [, displayName] = splitOrder(paramName);
    return displayName;
}

function getGroup(name: string): string {
    const [groupName] = splitName(name);
    const [, group] = splitOrder(groupName);
    return group;
}

function getChoices(workflow: RawWorkflow, node: any): string[] | undefined {
    const outputs = node.outputs || {};
    for (const outputId in outputs) {
        const connections = outputs[outputId];
        if (!Array.isArray(connections)) continue;
        
        for (const conn of connections) {
            const targetNode = workflow[conn[0]];
            if (!targetNode) continue;
            
            const inputName = conn[1];
            const inputType = targetNode.input_types?.[inputName];
            if (Array.isArray(inputType) && Array.isArray(inputType[0])) {
                return inputType[0];
            }
        }
    }
    return undefined;
}

export function extractWorkflowParameters(workflow: RawWorkflow): CustomParam[] {
    const params: CustomParam[] = [];

    for (const node of Object.values(workflow)) {
        const paramType = node.inputs?.type || '';
        const name = node.inputs?.name || 'Parameter';

        switch (node.class_type) {
            case 'ETN_KritaStyle':
                params.push({
                    kind: ParamKind.Style,
                    name,
                    default: node.inputs?.sampler_preset || 'auto',
                    displayName: getDisplayName(name),
                    group: getGroup(name)
                });
                break;

            case 'ETN_KritaImageLayer':
                params.push({
                    kind: ParamKind.ImageLayer,
                    name,
                    displayName: getDisplayName(name),
                    group: getGroup(name)
                });
                break;

            case 'ETN_KritaMaskLayer':
                params.push({
                    kind: ParamKind.MaskLayer,
                    name,
                    displayName: getDisplayName(name),
                    group: getGroup(name)
                });
                break;

            case 'Parameter':
                switch (paramType) {
                    case 'number (integer)':
                        params.push({
                            kind: ParamKind.NumberInt,
                            name,
                            default: node.inputs?.default || 0,
                            min: node.inputs?.min || -(2**31),
                            max: node.inputs?.max || 2**31,
                            displayName: getDisplayName(name),
                            group: getGroup(name)
                        });
                        break;

                    case 'number':
                        params.push({
                            kind: ParamKind.NumberFloat,
                            name,
                            default: node.inputs?.default || 0.0,
                            min: node.inputs?.min || 0.0,
                            max: node.inputs?.max || 1.0,
                            displayName: getDisplayName(name),
                            group: getGroup(name)
                        });
                        break;

                    case 'toggle':
                        params.push({
                            kind: ParamKind.Toggle,
                            name,
                            default: node.inputs?.default || false,
                            displayName: getDisplayName(name),
                            group: getGroup(name)
                        });
                        break;

                    case 'text':
                        params.push({
                            kind: ParamKind.Text,
                            name,
                            default: node.inputs?.default || '',
                            displayName: getDisplayName(name),
                            group: getGroup(name)
                        });
                        break;

                    case 'prompt (positive)':
                        params.push({
                            kind: ParamKind.PromptPositive,
                            name,
                            default: node.inputs?.default || '',
                            displayName: getDisplayName(name),
                            group: getGroup(name)
                        });
                        break;

                    case 'prompt (negative)':
                        params.push({
                            kind: ParamKind.PromptNegative,
                            name,
                            default: node.inputs?.default || '',
                            displayName: getDisplayName(name),
                            group: getGroup(name)
                        });
                        break;

                    case 'choice':
                        const choices = getChoices(workflow, node);
                        if (choices) {
                            params.push({
                                kind: ParamKind.Choice,
                                name,
                                default: node.inputs?.default || '',
                                choices,
                                displayName: getDisplayName(name),
                                group: getGroup(name)
                            });
                        } else {
                            params.push({
                                kind: ParamKind.Text,
                                name,
                                default: node.inputs?.default || '',
                                displayName: getDisplayName(name),
                                group: getGroup(name)
                            });
                        }
                        break;
                }
                break;
        }
    }

    // return params.sort((a, b) => {
    //     const groupCompare = a.group.localeCompare(b.group);
    //     if (groupCompare !== 0) return groupCompare;
    //     return a.displayName.localeCompare(b.displayName);
    // });
    return params;
} 