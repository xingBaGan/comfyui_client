# ComfyUI TypeScript 客户端

这是一个用TypeScript实现的ComfyUI客户端库，可以用来与ComfyUI服务器进行交互。这个客户端库是从krita-ai-diffusion项目移植而来，去除了UI相关的部分，专注于核心功能的实现。

## 功能特点

- 支持连接到ComfyUI服务器
- 支持创建和提交文生图工作流
- 支持工作流程进度追踪
- 支持WebSocket实时消息处理
- 完整的TypeScript类型定义
- 包含单元测试

## 安装

```bash
npm install
```

## 使用示例

```typescript
import { ComfyClient } from './comfy_client';
import { WorkflowInput } from './types';

async function main() {
    // 连接到ComfyUI服务器
    const client = await ComfyClient.connect('http://localhost:8188');
    
    // 创建工作流
    const workflow: WorkflowInput = {
        prompt: '一只可爱的猫咪，高清照片风格',
        negative_prompt: '模糊的，低质量的',
        width: 768,
        height: 512,
        steps: 30,
        cfg: 7.5,
        seed: Math.floor(Math.random() * 1000000)
    };
    
    // 提交工作流
    const jobId = await client.enqueue(workflow);
    console.log(`作业ID: ${jobId}`);
}
```

## 开发

1. 运行测试：
```bash
npm test
```

2. 运行示例：
```bash
npm run example
```

3. 构建项目：
```bash
npm run build
```

## API文档

### ComfyClient

主要的客户端类，用于与ComfyUI服务器交互。

#### 静态方法

- `connect(url?: string): Promise<ComfyClient>`
  连接到ComfyUI服务器。

#### 实例方法

- `enqueue(work: WorkflowInput, front?: boolean): Promise<string>`
  提交一个工作流到队列中。
  
- `disconnect(): Promise<void>`
  断开与服务器的连接。

### WorkflowInput

工作流输入参数接口。

```typescript
interface WorkflowInput {
    prompt: string;
    negative_prompt?: string;
    seed?: number;
    steps?: number;
    cfg?: number;
    width?: number;
    height?: number;
    batch_size?: number;
}
```

## 许可证

ISC 