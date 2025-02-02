import { useState, useEffect, useCallback, ChangeEvent } from "react";
import { v4 as uuidv4 } from 'uuid';

export interface WebSocketMessage {
    type: 'started' | 'completed' | 'progress' | 'error';
    jobId: string;
    result?: any;
    progress?: number;
    error?: string;
}

function WebsocketConnect() {
    const { ws, status, messages } = useWebsocketConnect();
    const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
    const [input, setInput] = useState('');

    useEffect(() => {
        if (messages.length > 0) {
            setLastMessage(messages[messages.length - 1]);
        }
    }, [messages]);

    // 处理图片上传
    const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            // 读取文件为Base64
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target?.result as string;
                // 发送图片数据
                ws?.send(JSON.stringify({
                    type: 'image',
                    data: base64,
                    filename: file.name
                }));
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('图片处理错误:', error);
        }
    };

    return (
        <div className="websocket-status">
            <div>状态: {status}</div>
            {lastMessage && (
                <div className="last-message">
                    <div>最新消息:</div>
                    <div>类型: {lastMessage.type}</div>
                    <div>任务ID: {lastMessage.jobId}</div>
                    {lastMessage.progress !== undefined && (
                        <div>进度: {(lastMessage.progress * 100).toFixed(1)}%</div>
                    )}
                    {lastMessage.error && (
                        <div className="error">错误: {lastMessage.error}</div>
                    )}
                </div>
            )}
            <div className="input-group">
                <input 
                    type="text" 
                    value={input} 
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="输入测试消息"
                    aria-label="测试消息输入"
                />
                <button onClick={() => {
                    ws?.send(JSON.stringify({ type: 'test', message: input }));
                    setInput('');
                }}>发送测试消息</button>
            </div>
            <div className="image-upload">
                <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    id="image-upload"
                    aria-label="选择图片"
                />
                <label htmlFor="image-upload" className="upload-label">
                    选择图片上传
                </label>
            </div>
            <style jsx>{`
                .websocket-status {
                    padding: 20px;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    max-width: 500px;
                    margin: 20px auto;
                }
                .last-message {
                    margin: 10px 0;
                    padding: 10px;
                    background: #f5f5f5;
                    border-radius: 4px;
                }
                .error {
                    color: red;
                }
                .input-group {
                    margin: 10px 0;
                    display: flex;
                    gap: 10px;
                }
                .input-group input {
                    flex: 1;
                    padding: 8px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                }
                button {
                    padding: 8px 16px;
                    background: #007bff;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                }
                button:hover {
                    background: #0056b3;
                }
                .image-upload {
                    margin-top: 20px;
                }
                .image-upload input[type="file"] {
                    display: none;
                }
                .upload-label {
                    display: inline-block;
                    padding: 8px 16px;
                    background: #28a745;
                    color: white;
                    border-radius: 4px;
                    cursor: pointer;
                }
                .upload-label:hover {
                    background: #218838;
                }
            `}</style>
        </div>
    );
}

function useWebsocketConnect() {
    const [ws, setWs] = useState<WebSocket | null>(null);
    const [status, setStatus] = useState('disconnected');
    const [messages, setMessages] = useState<WebSocketMessage[]>([]);
    const [clientId] = useState(() => uuidv4());

    const connect = useCallback(() => {
        const wsUrl = `ws://127.0.0.1:8187/ws?clientId=${clientId}`;
        const newWs = new WebSocket(wsUrl);

        newWs.onopen = () => {
            setStatus('connected');
            console.log('WebSocket连接已建立');
        };

        newWs.onclose = () => {
            setStatus('disconnected');
            console.log('WebSocket连接已关闭');
            // 5秒后尝试重新连接
            setTimeout(connect, 5000);
        };

        newWs.onerror = (error) => {
            console.error('WebSocket错误:', error);
            setStatus('error');
        };

        newWs.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data) as WebSocketMessage;
                setMessages(prev => [...prev, message]);
            } catch (error) {
                console.error('解析消息错误:', error);
            }
        };

        setWs(newWs);
    }, [clientId]);

    useEffect(() => {
        connect();
        return () => {
            if (ws) {
                ws.close();
            }
        };
    }, [connect]);

    return { ws, status, messages };
}

export default WebsocketConnect;