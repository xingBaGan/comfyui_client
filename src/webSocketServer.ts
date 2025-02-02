import { Request } from 'express';
import { ComfyClient, ExecutionResult } from './comfy_client.js';
import { ClientEvent } from './types/index.js';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';


export async function createWebSocketServer(app: Express.Application, port: number, ComfyUI_URL: string) {
    // 创建HTTP服务器
    const server = createServer(app);

    // 创建WebSocket服务器
    const wss = new WebSocketServer({ port: port });

    // 存储所有WebSocket连接
    const clients = new Map<string, WebSocket>();

    // WebSocket连接处理
    wss.on('connection', (ws: WebSocket, req: Request) => {
        // 从URL中获取clientId
        const url = new URL(req.url!, `http://${req.headers.host}`);
        const clientId = url.searchParams.get('clientId');

        if (!clientId) {
            ws.close();
            return;
        }

        // 存储连接
        clients.set(clientId, ws);

        wss.on('connection', function connection(ws) {
            // 创建ComfyUI客户端
            const comfyClient = new ComfyClient(ComfyUI_URL);
            ws.on('error', console.error);

            ws.on('message', function message(data) {
                console.log('received: %s', data);
                comfyClient.sendMessage(data.toString());
            });

            ws.on('close', function close() {
                console.log('WebSocket closed from browser', clientId);
            });

            ws.send(JSON.stringify({ type: 'connected', clientId }));
            console.log('WebSocket connected from browser', clientId);
            // 连接到ComfyUI服务器
            comfyClient.connect().then(() => {

                // 监听ComfyUI的事件并转发给浏览器
                comfyClient.on(ClientEvent.STARTED, (jobId: string) => {
                    ws.send(JSON.stringify({ type: 'started', jobId }));
                });

                comfyClient.on(ClientEvent.COMPLETED, (jobId: string, result: ExecutionResult) => {
                    ws.send(JSON.stringify({ type: 'completed', jobId, result }));
                });

                comfyClient.on(ClientEvent.Progress, (jobId: string, progress: number) => {
                    ws.send(JSON.stringify({ type: 'progress', jobId, progress }));
                });

                // 异步发送消息
                comfyClient.on(ClientEvent.Error, (jobId: string, error: Error) => {
                    // 如果ws存在，则发送消息
                    ws.send(JSON.stringify({ type: 'error', jobId, error: error.message }));
                });
            }).catch(error => {
                console.error('ComfyUI连接错误:', error);
                ws.close();
            });
        });

    });
    return server;
}
