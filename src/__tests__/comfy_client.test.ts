import { ComfyClient } from '../comfy_client.js';
import WebSocket from 'ws';
import fetch, { Response } from 'node-fetch';
import { jest } from '@jest/globals';

// 定义WebSocket mock的类型
type WebSocketEventCallback = (data?: any) => void;
let messageCallbacks: Record<string, WebSocketEventCallback> = {};
jest.mock('ws', () => {
    const mockWs = {
        OPEN: 1,
        CLOSED: 3,
        __esModule: true,
        default: jest.fn().mockImplementation(() => ({
            on: jest.fn((event: string, callback: WebSocketEventCallback) => {
                messageCallbacks[event] = callback;
                return this;
            }),
            close: jest.fn(),
            readyState: 1, // WebSocket.OPEN
            protocol: '',
            url: '',
            bufferedAmount: 0,
            extensions: '',
            binaryType: 'nodebuffer' as const,
            isPaused: false
        }))
    };
    return mockWs;
});

// Mock modules
const mockFetchImpl = jest.fn() as unknown as jest.MockedFunction<typeof fetch>;
jest.mock('node-fetch', () => ({
    __esModule: true,
    default: mockFetchImpl
}));




describe('ComfyClient', () => {
  it('should be able to connect to the server', async () => {
    const client = new ComfyClient('http://localhost:8188');
    await client.connect();
    expect(client.getIsConnected()).toBe(true);
  });
}); 