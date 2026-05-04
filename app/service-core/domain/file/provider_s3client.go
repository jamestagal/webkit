package file

import (
	"bytes"
	"context"
	"fmt"
	ot "service-core/pkg/otel"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// Helper functions for S3 and R2 providers
func uploadFileToProvider(ctx context.Context, client *s3.Client, bucketName string, file *File) error {
	done := ot.StartExternalCall(ctx, "s3", "put_object")
	_, err := client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(bucketName),
		Key:         aws.String(file.Key),
		Body:        bytes.NewReader(file.Data),
		ContentType: aws.String(file.ContentType),
	})
	done(err)
	if err != nil {
		return fmt.Errorf("error uploading file to S3, %w", err)
	}
	return nil
}

func downloadFileFromProvider(ctx context.Context, client *s3.Client, bucketName string, fileKey string) ([]byte, error) {
	done := ot.StartExternalCall(ctx, "s3", "get_object")
	output, err := client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(bucketName),
		Key:    aws.String(fileKey),
	})
	done(err)
	if err != nil {
		return nil, fmt.Errorf("error downloading file from S3, %w", err)
	}

	buf := new(bytes.Buffer)
	_, err = buf.ReadFrom(output.Body)
	if err != nil {
		return nil, fmt.Errorf("error reading file, %w", err)
	}

	return buf.Bytes(), nil
}

func removeFileFromProvider(ctx context.Context, client *s3.Client, bucketName string, fileKey string) error {
	done := ot.StartExternalCall(ctx, "s3", "delete_object")
	_, err := client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(bucketName),
		Key:    aws.String(fileKey),
	})
	done(err)
	if err != nil {
		return fmt.Errorf("error deleting file from S3, %w", err)
	}

	return nil
}
