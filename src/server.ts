import express, { Request, Response } from 'express';
import cors from 'cors';
import { ComfyClient, ExecutionResult } from './comfy_client.js';
import { RawWorkflow, ClientEvent, WorkflowNode } from './types/index.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// POST /api/tagger 端点
app.post('/api/tagger', async (req: Request, res: Response) => {
    // 初始化ComfyUI客户端
    const client = new ComfyClient('http://localhost:8188');
    try {
        const { imagePath } = req.body;

        if (!imagePath) {
            return res.status(400).json({
                success: false,
                error: '请提供图片路径 (imagePath)'
            });
        }

        // 连接到ComfyUI服务器
        await client.connect();
        
        // 加载tagger工作流
        const workflowsDir = join(__dirname, '..', 'workflows');
        const taggerPath = join(workflowsDir, 'tagger.json');
        const tagger = JSON.parse(readFileSync(taggerPath, 'utf-8')) as RawWorkflow;

        // 更新工作流中的图片输入节点
        const nodes = Object.values(tagger) as WorkflowNode[];
        const loadImageNode = nodes.find(node => node.class_type === 'LoadImage');
        if (loadImageNode) {
            loadImageNode.inputs.image = imagePath;
        }

        // 创建Promise以等待结果
        const resultPromise = new Promise((resolve, reject) => {
            client.on(ClientEvent.COMPLETED, (jobId: string, result: ExecutionResult) => {
                resolve(result);
            });
            
            client.on(ClientEvent.Error, (error: Error) => {
                reject(error);
            });
        });

        // 提交工作流
        const jobId = await client.enqueue(tagger);
        
        // 等待结果
        const result = await resultPromise;
        
        // 断开连接
        await client.disconnect();
        
        // 返回结果
        res.json({
            success: true,
            data: result
        });
        
    } catch (error) {
        console.error('API错误:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// 启动服务器
app.listen(port, () => {
    console.log(`服务器运行在 http://localhost:${port}`);
}); 