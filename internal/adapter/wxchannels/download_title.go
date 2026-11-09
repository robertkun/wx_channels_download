package wxchannelsadapter

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
	"unicode"

	"github.com/rs/zerolog"
)

const (
	download_title_llm_timeout = 20 * time.Second
	download_title_max_tokens  = 64
)

type llm_settings struct {
	base  string
	model string
	key   string
}

func (s llm_settings) usable() bool {
	return strings.TrimSpace(s.base) != "" && strings.TrimSpace(s.model) != "" && usable_api_key(s.key)
}

// download_filename asks the configured chat model for a short filename.
// A missing key or a failed request falls back to the first sentence.
func download_filename(caption string, logger *zerolog.Logger) string {
	caption = strings.TrimSpace(caption)
	if caption == "" || !caption_needs_generated_title(caption) {
		return caption
	}
	settings := load_llm_settings()
	if !settings.usable() {
		if logger != nil {
			logger.Info().Msg("下载标题未配置大模型，使用文案第一句")
		}
		return short_download_title(caption)
	}
	generated, err := request_download_title(settings, caption)
	if err != nil || strings.TrimSpace(generated) == "" {
		if logger != nil {
			logger.Warn().Err(err).Msg("大模型生成下载标题失败，使用文案第一句")
		}
		return short_download_title(caption)
	}
	if logger != nil {
		logger.Info().Str("title", generated).Msg("大模型已生成下载标题")
	}
	return generated
}

func caption_needs_generated_title(caption string) bool {
	if !contains_han(caption) {
		return false
	}
	if len([]rune(caption)) <= 20 && !strings.ContainsAny(caption, "。！？\r\n") {
		return false
	}
	return true
}

func contains_han(value string) bool {
	for _, r := range value {
		if unicode.Is(unicode.Han, r) {
			return true
		}
	}
	return false
}

func load_llm_settings() llm_settings {
	file_env := read_llm_dotenv()
	base := first_nonempty(os.Getenv("OLLAMA_BASE_URL"), file_env["OLLAMA_BASE_URL"], "https://api.deepseek.com/v1")
	model := first_nonempty(os.Getenv("OLLAMA_MODEL"), file_env["OLLAMA_MODEL"], "deepseek-flash")
	key := first_nonempty(os.Getenv("OLLAMA_API_KEY"), file_env["OLLAMA_API_KEY"])
	return llm_settings{
		base:  strings.TrimRight(strings.TrimSpace(base), "/"),
		model: strings.TrimSpace(model),
		key:   strings.TrimSpace(key),
	}
}

func usable_api_key(key string) bool {
	switch strings.ToLower(strings.TrimSpace(key)) {
	case "", "local", "ollama", "sk-your-key-here", "sk-your-deepseek-key":
		return false
	default:
		return true
	}
}

func first_nonempty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func read_llm_dotenv() map[string]string {
	merged := map[string]string{}
	for _, path := range llm_dotenv_candidates() {
		parsed, err := parse_dotenv_file(path)
		if err != nil {
			continue
		}
		for key, value := range parsed {
			if _, exists := merged[key]; !exists {
				merged[key] = value
			}
		}
	}
	return merged
}

func llm_dotenv_candidates() []string {
	candidates := make([]string, 0, 4)
	if explicit := strings.TrimSpace(os.Getenv("AUDIONOTES_ENV")); explicit != "" {
		candidates = append(candidates, explicit)
	}
	if wd, err := os.Getwd(); err == nil {
		candidates = append(candidates,
			filepath.Join(wd, "scripts", "audionotes.env"),
			filepath.Join(wd, "..", "..", "scripts", "audionotes.env"),
		)
	}
	if exe, err := os.Executable(); err == nil {
		candidates = append(candidates, filepath.Join(filepath.Dir(exe), "scripts", "audionotes.env"))
	}
	return candidates
}

func parse_dotenv_file(path string) (map[string]string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	parsed := map[string]string{}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.TrimSpace(value)
		value = strings.Trim(value, `"'`)
		if key != "" {
			parsed[key] = value
		}
	}
	return parsed, nil
}

func request_download_title(settings llm_settings, caption string) (string, error) {
	runes := []rune(caption)
	if len(runes) > 2000 {
		caption = string(runes[:2000])
	}
	payload := map[string]any{
		"model": settings.model,
		"messages": []map[string]string{
			{
				"role": "system",
				"content": "你是视频标题编辑。根据用户给出的视频文案，生成一个适合做文件名的简短中文标题。" +
					"只输出标题本身，不要引号、序号或解释。控制在20个汉字以内。" +
					"保留人名、车型、数字和关键事实，不要编造文案里没有的内容。",
			},
			{"role": "user", "content": caption},
		},
		"temperature": 0.2,
		"max_tokens":  download_title_max_tokens,
		"stream":      false,
	}
	if strings.Contains(strings.ToLower(settings.model), "deepseek") {
		payload["thinking"] = map[string]string{"type": "disabled"}
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	req, err := http.NewRequest(http.MethodPost, settings.base+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+settings.key)
	client := &http.Client{Timeout: download_title_llm_timeout}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	response_body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return "", err
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("大模型接口返回 HTTP %d", resp.StatusCode)
	}
	var parsed struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(response_body, &parsed); err != nil {
		return "", err
	}
	if len(parsed.Choices) == 0 {
		return "", fmt.Errorf("大模型没有返回标题")
	}
	title := clean_generated_title(parsed.Choices[0].Message.Content)
	if title == "" {
		return "", fmt.Errorf("大模型返回的标题为空")
	}
	return title, nil
}

func clean_generated_title(raw string) string {
	raw = strings.TrimSpace(raw)
	if index := strings.IndexAny(raw, "\r\n"); index >= 0 {
		raw = strings.TrimSpace(raw[:index])
	}
	raw = strings.TrimSpace(strings.TrimPrefix(strings.TrimPrefix(raw, "标题："), "标题:"))
	raw = strings.Map(func(r rune) rune {
		switch r {
		case '<', '>', ':', '"', '/', '\\', '|', '?', '*':
			return -1
		default:
			return r
		}
	}, raw)
	for i := 0; i < 3; i++ {
		next := strings.Trim(raw, "\"'“”‘’「」『』")
		next = strings.TrimRight(next, "。！？!?.，,、；;： ")
		next = strings.TrimSpace(next)
		if next == raw {
			break
		}
		raw = next
	}
	runes := []rune(raw)
	if len(runes) > download_title_max_runes {
		raw = strings.TrimRight(string(runes[:download_title_max_runes]), "，,、 ")
	}
	return strings.TrimSpace(raw)
}
