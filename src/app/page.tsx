'use client';
import {Button, Container, Divider, Paper, ScrollArea, Stepper, Text} from "@mantine/core";
import FileUploadForm from "./fileUploadForm";
import { useState } from "react";
import {UploadValues} from "@/types/frontend";

// Todo: 保守性
enum Progress {
    getPdfContent = 1,
    generateBusinessIdea = 2,
    discussion = 3,
    userFeedback = 4,
    done = 5,
}

export default function Home() {
    const [progress, setProgress] = useState<Progress>(Progress.getPdfContent);
    const [logs, setLogs] = useState<string>("");

    const handleSubmit = async (values: UploadValues) => {
        const formData = new FormData();
        formData.append('text', values.text);
        values.files.forEach((file, index) => {
            formData.append(`file_${index + 1}`, file);
        });

        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
        });

        if (response.ok && response.body) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let logs = '';
            let done = false;

            while (!done) {
                const { value, done: readerDone } = await reader.read();
                done = readerDone;

                if (value) {
                    const chunk = decoder.decode(value);
                    logs += chunk;
                    setLogs(logs);  // ログを逐次的に表示

                    // サーバーからのプログレス情報に基づいてステップを更新
                    if (chunk.includes('Slides read successfully')) {
                        setProgress(Progress.getPdfContent);
                    } else if (chunk.includes('Best business idea:')) {
                        setProgress(Progress.generateBusinessIdea);
                    } else if (chunk.includes('Refining business idea...')) {
                        setProgress(Progress.discussion);
                    } else if (chunk.includes('Collecting user feedback...')) {
                        setProgress(Progress.userFeedback);
                    }
                    else if (chunk.includes('Processing complete.')) {
                        setProgress(Progress.done);
                    }
                }
            }
        } else {
            console.log('File upload failed');
        }
    };

    const handleDownload = async () => {
        console.log("Download PDF");
        const response = await fetch('/api/download', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'slide.pdf';
            a.click();
            window.URL.revokeObjectURL(url);
        } else {
            console.error('Failed to generate PDF');
        }
    }

    return (
        <>
            <Container>
                <h1>LLMでビジネス企画書作成</h1>
                <Paper p="lg" shadow="md">
                    <FileUploadForm handleSubmit={handleSubmit} />
                    <Divider my={"md"} />
                    <h2>進行状況</h2>
                    <Stepper active={progress - 1}>
                        <Stepper.Step label="ステップ 1" description="PDFの内容を読み込み" />
                        <Stepper.Step label="ステップ 2" description="資産評価に基づくアイディア作成" />
                        <Stepper.Step label="ステップ 3" description="アイディアの具体化" />
                        {/*<Stepper.Step label="ステップ 4" description="仮想ユーザーからのフィードバック" />*/}
                        <Stepper.Step label="ステップ 4" description="最終資料の作成" />
                    </Stepper>


                    <ScrollArea>
                        <Paper p="md" shadow="xl">
                            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                                {logs}
                            </Text>
                            {
                                progress === Progress.done && (
                                    <>
                                        <Divider my={"md"} />
                                        <Button justify="center" fullWidth onClick={handleDownload}>PDFダウンロード</Button>
                                    </>
                                )
                            }
                        </Paper>
                    </ScrollArea>
                </Paper>
            </Container>
        </>
    );
}