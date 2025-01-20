import { ComfyClient } from './comfy_client.js';


interface User {
    id: string;
    name: string;
    imagesGenerated: number;
    credits: number;
}

interface ImageData {
    bytes?: Uint8Array;
    base64?: string;
    s3_object?: string;
    offsets: number[];
}

interface Inputs {
    image_data?: ImageData;
    [key: string]: any;
}

export class CloudClient extends ComfyClient {
    private static readonly DEFAULT_API_URL = process.env.INTERSTICE_URL || 'https://api.interstice.cloud';
    private static readonly DEFAULT_WEB_URL = process.env.INTERSTICE_WEB_URL || 'https://www.interstice.cloud';
    private token: string = '';
    private user: User | null = null;

    constructor(url: string) {
        super(url);
    }

    async AuthAndConnect(accessToken?: string): Promise<CloudClient> {
        if (accessToken) {
            await this.authenticate(accessToken);
        }
        await this.connect();
        return this;
    }

    async authenticate(token: string): Promise<User> {
        if (!token) {
            throw new Error('Authorization missing for cloud endpoint');
        }
        this.token = token;
        try {
            const userData = await this.get('user');
            this.user = {
                id: userData.id,
                name: userData.name,
                imagesGenerated: userData.images_generated,
                credits: userData.credits
            };
            console.log(`Connected to ${this.url}, user: ${this.user.id}`);
            return this.user;
        } catch (error) {
            this.token = '';
            throw error;
        }
    }

    async uploadImage(data: Uint8Array, filename: string): Promise<string> {    
        try {
            // 创建 FormData
            const formData = new FormData();
            const ext = filename.split('.').pop();
            // 创建 Blob 对象，根据文件扩展名设置正确的 MIME 类型
            const mimeType = ext?.startsWith('.') ? 
                `image/${ext.slice(1)}` : `image/${ext}`;
            const blob = new Blob([data], { type: mimeType });
            
            // 添加文件到 FormData，使用 'image' 作为字段名
            formData.append('image', blob, `${filename}`);  // 添加文件名

            // 直接使用fetch上传到 ComfyUI 的 upload/image 端点
            const response = await fetch(`${this.url}/upload/image`, {
                method: 'POST',
                body: formData
            }).then(res => res.json());
            console.log('response', response)
            // ComfyUI 返回的是包含文件名的对象
            if (response && response.name) {
                // 修正访问路径，ComfyUI 的图片存储在 /view/ 目录下
                const imageUrl = `${this.url}/view?filename=${filename}&type=input`;
                console.log(`Image uploaded successfully: ${imageUrl}`);
                return imageUrl;
            } else {
                throw new Error('Invalid response from server');
            }
        } catch (error) {
            console.error('Failed to upload image:', error);
            throw new Error('Image upload failed');
        }
    }

    private base64Size(size: number): number {
        return Math.ceil(size / 3) * 4;
    }
} 