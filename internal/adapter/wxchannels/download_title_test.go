package wxchannelsadapter

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestDownloadFilenameUsesModelTitle(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/chat/completions" {
			t.Errorf("path %s", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer test-key" {
			t.Errorf("missing authorization")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"「萧敬腾开箱张雪820RR」。"}}]}`))
	}))
	defer server.Close()
	t.Setenv("OLLAMA_BASE_URL", server.URL)
	t.Setenv("OLLAMA_MODEL", "deepseek-flash")
	t.Setenv("OLLAMA_API_KEY", "test-key")
	t.Setenv("AUDIONOTES_ENV", t.TempDir()+"/missing.env")

	caption := "11月3日，萧敬腾更新视频。视频中，萧敬腾开箱张雪820RR-R冠军版。此外还有很长的说明"
	got := download_filename(caption, nil)
	if got != "萧敬腾开箱张雪820RR" {
		t.Fatalf("got %q", got)
	}
}

func TestDownloadFilenameFallsBackWhenModelFails(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "nope", http.StatusBadGateway)
	}))
	defer server.Close()
	t.Setenv("OLLAMA_BASE_URL", server.URL)
	t.Setenv("OLLAMA_MODEL", "deepseek-flash")
	t.Setenv("OLLAMA_API_KEY", "test-key")
	t.Setenv("AUDIONOTES_ENV", t.TempDir()+"/missing.env")

	caption := "11月3日，萧敬腾更新视频。视频中还有后面的说明"
	got := download_filename(caption, nil)
	if got != "11月3日，萧敬腾更新视频" {
		t.Fatalf("got %q", got)
	}
}

func TestShortCaptionSkipsModel(t *testing.T) {
	got := download_filename("萧敬腾开箱", nil)
	if got != "萧敬腾开箱" {
		t.Fatalf("got %q", got)
	}
}
