import { CloudClient } from './cloud_client.js';
import { ClientEvent } from './types/index.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { ExecutionResult } from './comfy_client.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

async function main() {
    try {
        // 连接到云服务
        const client = new CloudClient('http://localhost:8188');
        await client.AuthAndConnect();
        console.log('已连接到云服务');


        // 加载工作流
        const workflowsDir = join(__dirname, '..', 'workflows');
        const taggerPath = join(workflowsDir, 'tagger_v2.json');
        const tagger = JSON.parse(readFileSync(taggerPath, 'utf-8'));
        console.log('tagger', tagger);
        console.log('提交工作流...');
        const jobId = await client.enqueue(tagger);
        console.log(`作业ID: ${jobId}`);
        client.on(ClientEvent.STARTED, (jobId: string) => {
            console.log(`开始作业ID: ${jobId}`);
        });
        client.on(ClientEvent.COMPLETED, (jobId: string, result: ExecutionResult) => {
            console.log(`完成作业ID: ${jobId}`);
            console.log('---------result.outputs---------', result.outputs);
        });

        client.on(ClientEvent.Error, (jobId: string, error: Error) => {
            console.error(`作业 ${jobId} 错误:`, error);
        });

        // 等待一段时间后中断
        setTimeout(async () => {
            await client.interrupt();
            console.log('已请求中断');
        }, 30000);

    } catch (error) {
        console.error('发生错误:', error);
    }
}

// 运行示例
main().catch(console.error); 