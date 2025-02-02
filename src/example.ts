import { ComfyClient, ExecutionResult } from './comfy_client.js';
import { WorkflowInput, RawWorkflow, ClientEvent } from './types/index.js';
import { WorkflowCollection } from './workflow_collection.js';
import { extractWorkflowParameters } from './workflow_parser.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

async function main() {
    try {
        // 初始化工作流集合
        const workflowsDir = join(__dirname, '..', 'workflows');
        const collection = new WorkflowCollection(workflowsDir);

        // 加载工作流文件夹中的所有工作流
        collection.loadFromFolder();
        console.log('已加载工作流:', collection.getAllWorkflows().map(w => w.id));

        // 连接到ComfyUI服务器
        const client = new ComfyClient('http://localhost:8188');
        await client.connect();
        console.log('Connected to ComfyUI server');
        client.sendMessage('Hello, ComfyUI!');
        // // 加载tagger工作流
        // const taggerPath = join(workflowsDir, 'tagger_v3.json');
        // const tagger = JSON.parse(readFileSync(taggerPath, 'utf-8')) as RawWorkflow;

        // // 解析工作流参数
        // const params = extractWorkflowParameters(tagger);
        // console.log('工作流参数:', params);

        // // 提交工作流并获取作业ID
        // console.log('提交工作流...');
        // const jobId = await client.enqueue(tagger);
        // console.log(`作业ID: ${jobId}`);
        // client.on(ClientEvent.STARTED, (jobId: string) => {
        //     console.log(`开始作业ID: ${jobId}`);
        // });
        // client.on(ClientEvent.COMPLETED, (jobId: string, result: ExecutionResult) => {
        //     console.log(`完成作业ID: ${jobId}`);
        //     console.log('---------result.outputs---------', result.outputs);
        // });
        // // 等待一段时间后断开连接
        // setTimeout(async () => {
        //     await client.disconnect();
        //     console.log('已断开连接');
        // }, 80000);

    } catch (error) {
        console.error('发生错误:', error);
    }
}

// 运行示例
main().catch(console.error); 