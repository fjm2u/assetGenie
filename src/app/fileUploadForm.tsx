import React, { useState } from 'react';
import { useForm } from '@mantine/form';
import { Dropzone } from '@mantine/dropzone';
import {Button, Group, Text, rem, Textarea, List} from '@mantine/core';
import { IconUpload, IconX } from '@tabler/icons-react';
import * as pdfjsLib from 'pdfjs-dist';
import {UploadValues} from "@/types/frontend";
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface FileUploadFormProps {
    handleSubmit: (values: UploadValues) => void;
}
const FileUploadForm: React.FC<FileUploadFormProps> = (
    { handleSubmit }: FileUploadFormProps
) => {
    const form = useForm<UploadValues>({
        initialValues: {
            text: '',
            files: [],
        },
    });
    const [files, setFiles] = useState<File[]>([]);

    const convertPdfToImages = async (pdfFile: File): Promise<File[]> => {
        const arrayBuffer = await pdfFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const numPages = pdf.numPages;
        const imageFiles: File[] = [];

        for (let i = 1; i <= numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context!, viewport }).promise;

            const imageFile = await new Promise<File>((resolve) => {
                canvas.toBlob((blob) => {
                    if (blob) {
                        const fileName = `${pdfFile.name}-page-${i}.png`;
                        const imageFile = new File([blob], fileName, { type: 'image/png' });
                        resolve(imageFile);
                    }
                }, 'image/png');
            });

            imageFiles.push(imageFile);
        }

        return imageFiles;
    };

    const handleDrop = async (files: File[]) => {
        console.log('Dropped files:', files);
        const pdfFile = files[0];
        if (pdfFile.type === 'application/pdf') {
            try {
                const imageFiles = await convertPdfToImages(pdfFile);
                setFiles(imageFiles);
                form.setFieldValue('files', imageFiles);
            } catch (error) {
                console.error('PDF conversion failed:', error);
            }
        } else {
            setFiles([pdfFile]);
            form.setFieldValue('files', [pdfFile]);
        }
    };

    return (
        <form onSubmit={form.onSubmit(handleSubmit)}>
            <Dropzone
                onDrop={handleDrop}
                onReject={(files) => console.log('rejected files', files)}
                maxSize={20 * 1024 ** 2} // 10mb
                accept={['application/pdf']}
                multiple={false}
            >
                <Group justify="center" gap="xl" mih={220} style={{pointerEvents: 'none'}}>
                    <Dropzone.Accept>
                        <IconUpload
                            style={{width: rem(52), height: rem(52), color: 'var(--mantine-color-blue-6)'}}
                            stroke={1.5}
                        />
                    </Dropzone.Accept>
                    <Dropzone.Reject>
                        <IconX
                            style={{width: rem(52), height: rem(52), color: 'var(--mantine-color-red-6)'}}
                            stroke={1.5}
                        />
                    </Dropzone.Reject>

                    <div>
                        <Text size="xl" inline>
                            ドラッグ&ドロップ
                        </Text>
                        <Text size="sm" c="dimmed" inline mt={7}>
                            企業情報等の資料をPDF形式でアップロード
                        </Text>
                    </div>
                </Group>
            </Dropzone>

            {files.length > 0 && (
                <>
                    <Text size="sm" mt="md">
                        選択されたファイル:
                    </Text>
                    <List>
                        {files.map((file, index) => (
                            <List.Item key={index}>{file.name}</List.Item>
                        ))}
                    </List>
                </>
            )}

            <Textarea
                pt={15}
                label="企画書の条件"
                placeholder="条件の情報を入力"
                {...form.getInputProps('text')}
                required
            />

            <Group align="right" mt="md">
                <Button type="submit">送信</Button>
            </Group>
        </form>
    );
};

export default FileUploadForm;