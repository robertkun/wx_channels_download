package api

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestResolveDownloadFileSkipsTranscriptSidecars(t *testing.T) {
	root := t.TempDir()
	stem := "雷椒椒服务员服务引热议_"
	write_download_file(t, filepath.Join(root, stem+".mp4"))
	write_download_file(t, filepath.Join(root, stem+".transcript.txt"))
	write_download_file(t, filepath.Join(root, stem+".transcript.timing.json"))
	write_download_file(t, filepath.Join(root, stem+".tmp"))

	client := &APIClient{cfg: &APIConfig{DownloadDir: root}}
	got, info, err := client.resolve_fetch_file_path(filepath.Join(root, stem))
	if err != nil {
		t.Fatal(err)
	}
	if filepath.Base(got) != stem+".mp4" || info.IsDir() {
		t.Fatalf("resolved %s", got)
	}
}

func TestFetchFileSendsAttachmentForDownload(t *testing.T) {
	gin.SetMode(gin.TestMode)
	root := t.TempDir()
	stem := "雷椒椒服务员服务引热议_"
	write_download_file(t, filepath.Join(root, stem+".mp4"))
	write_download_file(t, filepath.Join(root, stem+".transcript.txt"))
	write_download_file(t, filepath.Join(root, stem+".transcript.timing.json"))

	client := &APIClient{cfg: &APIConfig{DownloadDir: root}}
	router := gin.New()
	router.GET("/api/file", client.handle_fetch_file)
	req := httptest.NewRequest(http.MethodGet, "/api/file?download=1&path="+url.QueryEscape(filepath.Join(root, stem)), nil)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status %d body %s", recorder.Code, recorder.Body.String())
	}
	header := recorder.Header().Get("Content-Disposition")
	if !strings.Contains(header, "attachment;") || !strings.Contains(header, url.PathEscape(stem+".mp4")) {
		t.Fatalf("header = %s", header)
	}
}

func TestAttachmentHeaderKeepsChineseFilename(t *testing.T) {
	header := attachment_header("雷椒椒服务员服务引热议_.mp4")
	if !strings.Contains(header, `filename*=UTF-8''`) {
		t.Fatalf("header = %s", header)
	}
	if !strings.Contains(header, "%E9%9B%B7") {
		t.Fatalf("header = %s", header)
	}
}

func write_download_file(t *testing.T, path string) {
	t.Helper()
	if err := os.WriteFile(path, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
}
