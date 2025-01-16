import { ComfyClient } from '../comfy_client';
import WebSocket from 'ws';
import fetch, { Response, RequestInfo, RequestInit } from 'node-fetch';

jest.mock('ws');
jest.mock('node-fetch');

describe('ComfyClient', () => {
    let client: ComfyClient;
    const mockUrl = 'http://localhost:8188';

    beforeEach(() => {
        jest.clearAllMocks();
        // Mock system stats response
        (fetch as jest.MockedFunction<typeof fetch>).mockImplementation(
            async (url: URL | RequestInfo, init?: RequestInit): Promise<Response> => {
                const urlStr = url.toString();
                const mockResponse = (data: any) => Promise.resolve({
                    json: () => Promise.resolve(data)
                } as Response);

                if (urlStr.endsWith('system_stats')) {
                    return mockResponse({
                        device: {
                            type: 'cuda',
                            name: 'NVIDIA GeForce RTX 3080',
                            total_memory: 10000,
                            free_memory: 8000
                        }
                    });
                }
                if (urlStr.endsWith('object_info')) {
                    return mockResponse({
                        testNode: {
                            input: {
                                required: {
                                    param1: ['value1', 'value2']
                                }
                            }
                        }
                    });
                }
                return mockResponse({});
            }
        );
    });

    describe('connect', () => {
        it('should connect to ComfyUI server successfully', async () => {
            const mockWs = {
                on: jest.fn((event, callback) => {
                    if (event === 'open') {
                        callback();
                    }
                }),
                close: jest.fn()
            };
            (WebSocket as unknown as jest.Mock).mockImplementation(() => mockWs);

            client = await ComfyClient.connect(mockUrl);

            expect(client).toBeDefined();
            expect(WebSocket).toHaveBeenCalled();
            expect(fetch).toHaveBeenCalledWith(`${mockUrl}/system_stats`);
            expect(fetch).toHaveBeenCalledWith(`${mockUrl}/object_info`);
        });

        it('should handle connection errors', async () => {
            const mockWs = {
                on: jest.fn((event, callback) => {
                    if (event === 'error') {
                        callback(new Error('Connection failed'));
                    }
                }),
                close: jest.fn()
            };
            (WebSocket as unknown as jest.Mock).mockImplementation(() => mockWs);

            await expect(ComfyClient.connect(mockUrl)).rejects.toThrow();
        });
    });

    describe('enqueue', () => {
        beforeEach(async () => {
            const mockWs = {
                on: jest.fn((event, callback) => {
                    if (event === 'open') {
                        callback();
                    }
                }),
                close: jest.fn()
            };
            (WebSocket as unknown as jest.Mock).mockImplementation(() => mockWs);
            client = await ComfyClient.connect(mockUrl);
        });

        it('should enqueue a job successfully', async () => {
            const mockPromptId = 'test-prompt-id';
            (fetch as jest.MockedFunction<typeof fetch>)
                .mockImplementationOnce(async () => ({
                    json: () => Promise.resolve({ prompt_id: mockPromptId })
                } as Response));

            const work = {
                prompt: 'test prompt',
                negative_prompt: 'test negative',
                steps: 20
            };

            const jobId = await client.enqueue(work);
            expect(jobId).toBeDefined();
            expect(fetch).toHaveBeenCalledWith(
                `${mockUrl}/prompt`,
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                })
            );
        });

        it('should handle enqueue errors', async () => {
            (fetch as jest.MockedFunction<typeof fetch>)
                .mockImplementationOnce(() => Promise.reject(new Error('Failed to enqueue')));

            const work = {
                prompt: 'test prompt'
            };

            await expect(client.enqueue(work)).rejects.toThrow('Failed to enqueue job');
        });
    });

    describe('message handling', () => {
        let mockWs: any;
        let messageCallback: (data: string) => void;

        beforeEach(async () => {
            mockWs = {
                on: jest.fn((event, callback) => {
                    if (event === 'open') {
                        callback();
                    } else if (event === 'message') {
                        messageCallback = callback;
                    }
                }),
                close: jest.fn()
            };
            (WebSocket as unknown as jest.Mock).mockImplementation(() => mockWs);
            client = await ComfyClient.connect(mockUrl);
        });

        it('should handle execution progress messages', async () => {
            const work = { prompt: 'test' };
            (fetch as jest.MockedFunction<typeof fetch>)
                .mockImplementationOnce(async () => ({
                    json: () => Promise.resolve({ prompt_id: 'test-id' })
                } as Response));

            const jobId = await client.enqueue(work);

            // 模拟执行开始消息
            messageCallback(JSON.stringify({
                type: 'executing',
                data: { prompt_id: 'test-id' }
            }));

            // 模拟进度消息
            messageCallback(JSON.stringify({
                type: 'progress',
                data: { value: 0.5 }
            }));

            // 模拟执行完成消息
            messageCallback(JSON.stringify({
                type: 'executed',
                data: { prompt_id: 'test-id' }
            }));

            expect(jobId).toBeDefined();
        });
    });
}); 