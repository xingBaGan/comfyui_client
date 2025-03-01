import express, { Request, Response } from 'express';
import cors from 'cors';
import { ComfyClient, ExecutionResult } from './comfy_client.js';
import { CloudClient } from './cloud_client.js';
import { RawWorkflow, ClientEvent, WorkflowNode } from './types/index.js';
import { createWebSocketServer } from './webSocketServer.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
// 读取传入的ComfyUI_URL 参数
export const ComfyUI_URL = process.argv[2];
const __dirname = fileURLToPath(new URL('.', import.meta.url));

// 获取 workflows 目录路径
function getWorkflowsPath() {
    // 检查是否在 Electron 打包环境中
    if (process.resourcesPath) {
        return join(process.resourcesPath, 'comfyui_client', 'workflows');
    }
    // 开发环境
    return join(__dirname, '..', 'workflows');
}

export const app = express();
const port = 3000;

const websocketPort = 8187;
app.use(cors());
app.use(express.json());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// POST /api/upload 端点 - 处理图片上传
app.post('/api/upload', async (req: Request, res: Response) => {
    let client: CloudClient;
    try {
        const { imagePath } = req.body;
        const filename = imagePath.split('\\').pop();

        client = new CloudClient(ComfyUI_URL);
        await client.AuthAndConnect();

        if (!imagePath) {
            return res.status(400).json({
                success: false,
                error: '请提供图片路径 (imagePath)'
            });
        }

        // 读取本地图片数据为Buffer
        const imageBuffer = readFileSync(imagePath);
        const imageData = new Uint8Array(imageBuffer);
        const imageUrl = await client.uploadImage(imageData, filename);

        // 断开连接
        await client.disconnect();

        // 返回上传后的URL
        res.json({
            success: true,
            data: {
                imageUrl
            }
        });

    } catch (error) {
        console.error('上传错误:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// POST /api/tagger 端点 - 处理标签生成
app.post('/api/tagger', async (req: Request, res: Response) => {
    let client: ComfyClient | CloudClient;
    try {
        let { imagePath, isRemote } = req.body;
        if (!imagePath) {
            return res.status(400).json({
                success: false,
                error: '请提供图片路径或URL (imagePath)'
            });
        }

        if (isRemote) {
            client = new CloudClient(ComfyUI_URL);
            await (client as CloudClient).AuthAndConnect();
        } else {
            client = new ComfyClient(ComfyUI_URL);
            await client.connect();
        }

        const workflow_name = 'tagger_v2';
        const node_name = 'LoadImageFromUrl';
        // 加载tagger工作流
        const workflowsDir = getWorkflowsPath();
        const taggerPath = join(workflowsDir, `${workflow_name}.json`);
        const tagger = JSON.parse(readFileSync(taggerPath, 'utf-8')) as RawWorkflow;

        // 更新工作流中的图片输入节点
        const nodes = Object.values(tagger) as WorkflowNode[];
        const loadImageNode = nodes.find(node => node.class_type === node_name);
        if (loadImageNode) {
            loadImageNode.inputs.image = imagePath;
        }

        // 创建Promise以等待结果
        const resultPromise = new Promise((resolve, reject) => {
            client.on(ClientEvent.COMPLETED, (jobId: string, result: ExecutionResult) => {
                resolve(result);
            });

            client.on(ClientEvent.Error, (jobId: string, error: Error) => {
                console.error('ComfyUI 服务器错误:', error);
                reject(error);
            });
        });

        // 提交工作流
        const jobId = await client.enqueue(tagger);
        console.log('jobId', jobId);
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

createWebSocketServer(app, websocketPort, ComfyUI_URL).then((server) => {
    // 使用HTTP服务器而不是Express app来监听
    server.listen(port, () => {
        console.log(`服务器运行在 http://localhost:${port}`);
    }); 
});