import { ComfyClient } from './comfy_client.js';
import { WorkflowInput, RawWorkflow } from './types/index.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

async function main() {
    try {
        // 连接到ComfyUI服务器
        const client = await ComfyClient.connect('http://localhost:8188');
        console.log('Connected to ComfyUI server');

        // 加载tagger工作流
        const taggerPath = join(__dirname, '..', 'workflows', 'tagger.json');
        const tagger = JSON.parse(readFileSync(taggerPath, 'utf-8')) as RawWorkflow;

        // 提交工作流并获取作业ID
        console.log('提交工作流...');
        const jobId = await client.enqueue(tagger);
        console.log(`作业ID: ${jobId}`);

        // 等待一段时间后断开连接
        setTimeout(async () => {
            await client.disconnect();
            console.log('已断开连接');
        }, 10000);

    } catch (error) {
        console.error('发生错误:', error);
    }
}

// 运行示例
main().catch(console.error); 