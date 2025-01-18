# ComfyUI Client API 文档

## REST API

### 图片标签生成 API

用于对图片进行标签生成的 API 接口。

**请求信息：**

- 端点：`POST /api/tagger`
- Content-Type: `application/json`
- CORS：已启用

**请求参数：**

```typescript
{
  // 图片文件的本地路径（必须是ComfyUI服务器可访问的路径）
  imagePath: string;
}
```

**响应格式：**

```typescript
{
  // 请求是否成功
  success: boolean;

  // 成功时返回的数据
  data?: {
    // 生成的图片数组（如果有）
    images?: any[];
    
    // 工作流输出结果
    outputs?: {
      // 标签文本输出
      tags: string[];
    };
  };

  // 失败时返回的错误信息
  error?: string;
}
```

**状态码：**

- 200：请求成功
- 400：请求参数错误（如缺少imagePath）
- 500：服务器内部错误

**示例：**

请求：
```bash
curl -X POST http://localhost:3000/api/tagger \
  -H "Content-Type: application/json" \
  -d '{
    "imagePath": "/path/to/image.jpg"
  }'
```

成功响应：
```json
{
  "success": true,
  "data": {
    "images": [],
    "outputs": {
      "tags": [
        "1girl, solo, long_hair, looking_at_viewer, bangs, brown_hair, black_hair, brown_eyes, closed_mouth, black_eyes, lips, blue_background, portrait, close-up, realistic, nose"
      ]
    }
  }
}
```

错误响应：
```json
{
  "success": false,
  "error": "请提供图片路径 (imagePath)"
}
```

**注意事项：**

1. 图片路径必须是 ComfyUI 服务器可以访问的本地路径
2. 服务器会自动连接和断开与 ComfyUI 的连接
3. 处理过程可能需要几秒钟时间
4. 输出格式可能会根据工作流的不同而变化

## WebSocket 事件

服务器在处理请求时会触发以下 WebSocket 事件：

- `progress`：处理进度更新
- `completed`：处理完成
- `error`：发生错误
- `interrupted`：处理被中断

## 配置选项

### 服务器配置

```typescript
{
  port: 3000,              // 服务器端口
  comfyuiUrl: string,      // ComfyUI服务器地址
  workflowPath: string     // 工作流文件路径
}
```

### CORS 配置

默认允许所有源访问。如需修改，请在 `server.ts` 中配置 CORS 选项：

```typescript
app.use(cors({
  origin: 'your-domain.com',
  methods: ['POST'],
  allowedHeaders: ['Content-Type']
}));
```

## 错误处理

服务器会返回标准的错误响应格式：

```typescript
{
  success: false,
  error: string  // 错误描述
}
```

常见错误：

1. 缺少必要参数
2. 图片路径不存在或无法访问
3. ComfyUI 服务器连接失败
4. 工作流执行错误

## 性能考虑

1. 每个请求都会建立新的 WebSocket 连接
2. 处理完成后会自动断开连接
3. 支持并发请求
4. 建议客户端实现超时处理 