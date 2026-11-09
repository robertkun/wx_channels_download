package services

import (
	"os"
	"path/filepath"
	"testing"

	"wx_channel/internal/database/model"
)

func TestDeleteRemovesFinishedVideoAndTranscripts(t *testing.T) {
	root := t.TempDir()
	stem := filepath.Join(root, "雷椒椒服务员服务引热议_")
	write_file(t, stem+".mp4")
	write_file(t, stem+".transcript.txt")
	write_file(t, stem+".transcript.timing.json")

	service := &DownloadTaskService{download_dir: root}
	resource := model.DownloadResource{
		Name:        "雷椒椒服务员服务引热议_",
		Kind:        "video/mp4",
		DownloadDir: root,
	}
	if err := service.delete_download_task_local_files(model.DownloadTask{}, []model.DownloadResource{resource}); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{stem + ".mp4", stem + ".transcript.txt", stem + ".transcript.timing.json"} {
		if _, err := os.Stat(name); !os.IsNotExist(err) {
			t.Fatalf("file still exists: %s (%v)", name, err)
		}
	}
}

func TestDeleteRemovesVideoWhenRecordStillHasTempName(t *testing.T) {
	root := t.TempDir()
	stem := filepath.Join(root, "雷椒椒服务员服务引热议_")
	write_file(t, stem+".mp4")
	write_file(t, stem+".transcript.txt")

	service := &DownloadTaskService{download_dir: root}
	resource := model.DownloadResource{
		Name:        "雷椒椒服务员服务引热议_.tmp",
		Kind:        "video/mp4",
		DownloadDir: root,
	}
	if err := service.delete_download_task_local_files(model.DownloadTask{}, []model.DownloadResource{resource}); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(stem + ".mp4"); !os.IsNotExist(err) {
		t.Fatalf("mp4 still exists: %v", err)
	}
	if _, err := os.Stat(stem + ".transcript.txt"); !os.IsNotExist(err) {
		t.Fatalf("transcript still exists: %v", err)
	}
}

func write_file(t *testing.T, path string) {
	t.Helper()
	if err := os.WriteFile(path, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
}
