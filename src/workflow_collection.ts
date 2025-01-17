import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { EventEmitter } from 'events';
import { RawWorkflow } from './types/index.js';
import { CustomWorkflow, WorkflowSource } from './types/workflow.js';

export class WorkflowCollection extends EventEmitter {
    private workflows: Map<string, CustomWorkflow>;
    private workflowsFolder: string;

    constructor(workflowsFolder: string) {
        super();
        this.workflows = new Map();
        this.workflowsFolder = workflowsFolder;
    }

    loadFromFolder(): void {
        try {
            const files = readdirSync(this.workflowsFolder);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    this.loadFromFile(join(this.workflowsFolder, file));
                }
            }
        } catch (error) {
            console.error('Error loading workflows from folder:', error);
        }
    }

    loadFromFile(filePath: string): void {
        try {
            const content = readFileSync(filePath, 'utf-8');
            const workflow = JSON.parse(content) as RawWorkflow;
            const id = filePath.split('/').pop()?.replace('.json', '') || '';
            this.addWorkflow({
                id,
                source: WorkflowSource.Local,
                workflow,
                path: filePath
            });
        } catch (error) {
            console.error(`Error loading workflow from ${filePath}:`, error);
        }
    }

    addWorkflow(workflow: CustomWorkflow): void {
        this.workflows.set(workflow.id, workflow);
        this.emit('workflowAdded', workflow);
    }

    getWorkflow(id: string): CustomWorkflow | undefined {
        return this.workflows.get(id);
    }

    removeWorkflow(id: string): boolean {
        const workflow = this.workflows.get(id);
        if (workflow) {
            if (workflow.source === WorkflowSource.Local && workflow.path) {
                try {
                    require('fs').unlinkSync(workflow.path);
                } catch (error) {
                    console.error(`Error deleting workflow file ${workflow.path}:`, error);
                }
            }
            this.workflows.delete(id);
            this.emit('workflowRemoved', id);
            return true;
        }
        return false;
    }

    saveWorkflow(id: string, workflow: RawWorkflow): string {
        let finalId = id;
        let suffix = 1;
        while (this.workflows.has(finalId)) {
            finalId = `${id} (${suffix})`;
            suffix++;
        }

        const filePath = join(this.workflowsFolder, `${finalId}.json`);
        try {
            require('fs').mkdirSync(this.workflowsFolder, { recursive: true });
            writeFileSync(filePath, JSON.stringify(workflow, null, 2));
            
            const customWorkflow: CustomWorkflow = {
                id: finalId,
                source: WorkflowSource.Local,
                workflow,
                path: filePath
            };
            this.addWorkflow(customWorkflow);
            return finalId;
        } catch (error) {
            throw new Error(`Error saving workflow: ${error}`);
        }
    }

    getAllWorkflows(): CustomWorkflow[] {
        return Array.from(this.workflows.values());
    }

    clear(): void {
        this.workflows.clear();
        this.emit('workflowsCleared');
    }
} 