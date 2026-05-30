/**
 * S3 file upload utility.
 *
 * Uploads files to the configured AWS S3 bucket and returns the file URL.
 * Used by the application form for document attachments (proof of preference, etc.)
 */

import {
  S3Client,
  PutObjectCommand,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3"
import { env } from "../../config/env"

let s3Client: S3Client | null = null

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: env.AWS_S3_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      },
    })
  }
  return s3Client
}

export interface UploadResult {
  url: string
  key: string
  bucket: string
  contentType: string
}

export interface UploadFileInput {
  /** Raw file buffer */
  buffer: Buffer
  /** Original file name */
  fileName: string
  /** MIME content type */
  contentType: string
  /** Optional subdirectory path prefix (e.g., "applications/abc123") */
  prefix?: string
}

/**
 * Uploads a file buffer to S3.
 * Returns the public URL, S3 key, bucket name, and content type.
 */
export async function uploadFileToS3(input: UploadFileInput): Promise<UploadResult> {
  const { buffer, fileName, contentType, prefix } = input

  const timestamp = Date.now()
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_")
  const key = prefix
    ? `${prefix}/${timestamp}-${sanitizedName}`
    : `uploads/${timestamp}-${sanitizedName}`

  const params: PutObjectCommandInput = {
    Bucket: env.AWS_S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }

  const client = getS3Client()
  await client.send(new PutObjectCommand(params))

  const url = `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_S3_REGION}.amazonaws.com/${key}`

  return {
    url,
    key,
    bucket: env.AWS_S3_BUCKET,
    contentType,
  }
}
