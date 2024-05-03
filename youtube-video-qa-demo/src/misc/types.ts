import { Document } from 'langchain/document';

interface VideoInfo {
    id: string;
    title: string;
    description: string;
    thumbnail: string;
    link?: string;
}

export {
    VideoInfo,
    Document
}