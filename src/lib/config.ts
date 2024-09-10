import OpenAI from 'openai';
import path from "path";

export const client = new OpenAI({
    apiKey: process.env['OPENAI_API_KEY'],
});

export const model = "gpt-4o-2024-08-06";

export const uploadDir = path.join(process.cwd(), 'uploads');
