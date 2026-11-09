package services

import (
	"os"
	"path/filepath"
	"testing"

	"wx_channel/internal/database/model"
)

func TestCompletedBytesCountAsFinished(t *testing.T) {
	status := ComputeEffectiveTaskStatusFromSummary(model.TaskStatusDownloading, 1, 1, false)
	if status != model.TaskStatusFinished {
		t.Fatalf("status = %d", status)
	}
}

func TestPartialDownloadStaysDownloading(t *testing.T) {
	status := ComputeEffectiveTaskStatusFromSummary(model.TaskStatusDownloading, 1, 0, true)
	if status != model.TaskStatusDownloading {
		t.Fatalf("status = %d", status)
	}
}

func TestCompletedOutputPathFindsRenamedVideo(t *testing.T) {
	root := t.TempDir()
	stem := filepath.Join(root, "雷椒椒服务员服务引热议_")
	if err := os.WriteFile(stem+".mp4", []byte("video"), 0o644); err != nil {
		t.Fatal(err)
	}
	got := completed_output_path(DownloadTaskFileRecord{
		FilePath: stem + ".tmp",
		Kind:     "video/mp4",
	})
	if got != stem+".mp4" {
		t.Fatalf("path = %s", got)
	}
}

func TestTemporaryFileIsNotComplete(t *testing.T) {
	root := t.TempDir()
	stem := filepath.Join(root, "雷椒椒服务员服务引热议_")
	if err := os.WriteFile(stem+".tmp", []byte("partial"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(stem+".mp4", []byte("video"), 0o644); err != nil {
		t.Fatal(err)
	}
	got := completed_output_path(DownloadTaskFileRecord{
		FilePath: stem + ".tmp",
		Kind:     "video/mp4",
	})
	if got != "" {
		t.Fatalf("path = %s", got)
	}
}
