import { proxy_image_url } from "@/image-proxy.model.js";

const DOWNLOAD_PAGE_SIZE_DEFAULT = 50;

const DOWNLOAD_SERVER_STATUS_FILTERS = {
  wait: "0,1",
  running: "2,4",
  pause: "3",
  done: "5",
  error: "6,7",
};

function runtime_flag(value) {
  if (value === true || value === 1) return true;
  if (typeof value !== "string") return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function is_download_open_external() {
  return (
    runtime_flag(window.config.remoteServerEnabled) ||
    runtime_flag(window.config.inDocker)
  );
}

function task_console_origin() {
  const location = window.location || {};
  const origin = location.origin || "http://127.0.0.1:2022";
  return `${origin}/console`;
}

function task_record_files(raw) {
  if (!raw || typeof raw !== "object") return [];
  if (Array.isArray(raw.files)) return raw.files;
  return Array.isArray(raw.resources) ? raw.resources : [];
}

function media_extension(path) {
  const name = String(path || "").split(/[\\/]/).pop() || "";
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

const MEDIA_FILE_EXTENSIONS = [
  ".mp4",
  ".mov",
  ".mkv",
  ".webm",
  ".m4v",
  ".avi",
  ".flv",
  ".ts",
  ".mp3",
  ".m4a",
  ".wav",
  ".aac",
  ".flac",
  ".ogg",
];

function is_media_file_path(path) {
  return MEDIA_FILE_EXTENSIONS.includes(media_extension(path));
}

function media_rank(file) {
  const kind = String((file && file.kind) || "").toLowerCase();
  const extension = media_extension(
    file && (file.file_path || file.filepath || file.local_path || file.name),
  );
  if (
    kind.startsWith("video/") ||
    [".mp4", ".mov", ".mkv", ".webm", ".m4v", ".avi", ".flv", ".ts"].includes(
      extension,
    )
  ) {
    return 0;
  }
  if (
    kind.startsWith("audio/") ||
    [".mp3", ".m4a", ".wav", ".aac", ".flac", ".ogg"].includes(extension)
  ) {
    return 1;
  }
  return 9;
}

function is_http_url(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function task_source_media_url(raw) {
  const files = task_record_files(raw)
    .map((file) => ({
      file,
      url: String((file && file.url) || "").trim(),
      status: String((file && file.status) || "").toLowerCase(),
    }))
    .filter((item) => is_http_url(item.url) && item.status !== "deleted");
  files.sort((left, right) => media_rank(left.file) - media_rank(right.file));
  const chosen = files.find((item) => media_rank(item.file) < 9) || files[0];
  return chosen ? chosen.url : "";
}

function readable_transcript(raw) {
  const text = String(raw || "").trim();
  if (!text) return "";
  if (text.startsWith("{")) {
    try {
      const payload = JSON.parse(text);
      if (
        payload &&
        typeof payload === "object" &&
        "code" in payload &&
        Number(payload.code) !== 0
      ) {
        return "";
      }
    } catch (_error) {
      return text;
    }
  }
  return text;
}

function transcript_sidecar_path(media_path) {
  const path = String(media_path || "").trim();
  if (!path) return "";
  const slash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  const dir = slash >= 0 ? path.slice(0, slash + 1) : "";
  const name = slash >= 0 ? path.slice(slash + 1) : path;
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  if (!stem) return "";
  return `${dir}${stem}.transcript.txt`;
}

function task_media_path(raw) {
  const files = task_record_files(raw)
    .map((file) => ({
      file,
      path: String(
        (file && (file.file_path || file.filepath || file.local_path)) || "",
      ).trim(),
      status: String((file && file.status) || "").toLowerCase(),
    }))
    .filter(
      (item) =>
        item.path && item.status !== "deleted" && is_media_file_path(item.path),
    );
  files.sort((left, right) => media_rank(left.file) - media_rank(right.file));
  const chosen = files.find((item) => media_rank(item.file) < 9);
  if (chosen) return chosen.path;
  // 任务顶层 file_path 有时是目录或未带后缀；只有确实是音视频文件时才回退使用。
  const top = String(
    (raw && (raw.file_path || raw.filepath || raw.local_path)) || "",
  ).trim();
  return is_media_file_path(top) ? top : "";
}

function task_cover_url(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  return proxy_image_url(
    source.platform_id ||
      source.platformId ||
      source.PlatformID ||
      source.PlatformId,
    source.cover_url || source.coverUrl || source.CoverURL,
  );
}

function normalize_download_status(status) {
  const value = String(status ?? "")
    .trim()
    .toLowerCase();
  if (["0", "waiting", "creating", "pending", "queued", "ready"].includes(value)) {
    return "wait";
  }
  if (
    ["1", "2", "4", "running", "downloading", "preparing", "merging"].includes(
      value,
    )
  ) {
    return "running";
  }
  if (["3", "pause", "paused"].includes(value)) return "pause";
  if (["5", "done", "finished", "completed", "success"].includes(value)) {
    return "done";
  }
  if (
    [
      "6",
      "7",
      "error",
      "fail",
      "failed",
      "failure",
      "errored",
      "cancelled",
      "canceled",
    ].includes(value)
  ) {
    return "error";
  }
  return value || "wait";
}

function is_download_waiting_status(status) {
  return normalize_download_status(status) === "wait";
}

function format_download_speed(bytes_per_second) {
  const value = Math.max(0, Number(bytes_per_second) || 0);
  const kilobyte = 1024;
  const megabyte = kilobyte * 1024;
  if (value >= megabyte) return `${(value / megabyte).toFixed(1)} MB/s`;
  if (value >= kilobyte) return `${(value / kilobyte).toFixed(1)} KB/s`;
  return `${value.toFixed(1)} B/s`;
}

function format_download_size(bytes) {
  const value = Math.max(0, Number(bytes) || 0);
  if (value === 0) return "0.0KB";
  const units = ["bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const exponent = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  );
  if (exponent < 1) return `${value.toFixed(1)} ${units[0]}`;
  return `${(value / Math.pow(1024, exponent)).toFixed(1)}${units[exponent]}`;
}

function format_download_percent(record) {
  const progress = record && record.progress;
  const direct = Number(progress);
  if (Number.isFinite(direct)) {
    return Math.min(100, Math.max(0, Math.round(direct * 100) / 100));
  }
  const detail = progress && typeof progress === "object" ? progress : {};
  const detail_percent = Number(detail.percent ?? detail.progress);
  if (Number.isFinite(detail_percent)) {
    return Math.min(100, Math.max(0, Math.round(detail_percent * 100) / 100));
  }
  const total = Number(
    (record && record.size) || detail.total || detail.size || 0,
  );
  const downloaded = Number(
    (record && record.downloaded) || detail.downloaded || 0,
  );
  if (total <= 0) return 0;
  return Math.min(
    100,
    Math.max(0, Math.round(((downloaded * 100) / total) * 100) / 100),
  );
}

function empty_status_counts() {
  return {
    total: 0,
    running: 0,
    pause: 0,
    wait: 0,
    done: 0,
    error: 0,
  };
}

function server_status_filter(status) {
  return DOWNLOAD_SERVER_STATUS_FILTERS[status] || "";
}

function normalize_server_status_counts(source) {
  const counts = empty_status_counts();
  Object.entries(source || {}).forEach(([status, count]) => {
    const value = Number(count) || 0;
    const key = String(status).trim().toLowerCase();
    if (key === "total") counts.total += value;
    else if (["0", "1", "waiting", "preparing", "wait"].includes(key)) {
      counts.wait += value;
    } else if (["2", "4", "downloading", "merging", "running"].includes(key)) {
      counts.running += value;
    } else if (["3", "paused", "pause"].includes(key)) {
      counts.pause += value;
    } else if (["5", "finished", "completed", "done"].includes(key)) {
      counts.done += value;
    } else if (["6", "7", "failed", "cancelled", "error"].includes(key)) {
      counts.error += value;
    }
  });
  if (!Object.prototype.hasOwnProperty.call(source || {}, "total")) {
    counts.total =
      counts.running +
      counts.pause +
      counts.wait +
      counts.done +
      counts.error;
  }
  return counts;
}

function task_identifier(value) {
  if (!value || typeof value !== "object") return value;
  if (value.state && value.state.id) return value.state.id.value;
  if (value.id && typeof value.id === "object" && "value" in value.id) {
    return value.id.value;
  }
  return value.id ?? value.task_id;
}

function DownloadV2Model(props = {}) {
  const {
    downloader = window.dl$,
    fixedListHeight: fixed_list_height = false,
    itemHeight: item_height = 82,
    listBuffer: list_buffer = 10,
    listHeight: list_height = 380,
  } = props;
  if (!downloader || typeof downloader.refresh !== "function") {
    throw new TypeError("DownloadV2Model requires the global dl$ instance");
  }

  const tasks_ = refarr([]);
  const task_count_ = ref(0);
  const filtered_task_count_ = ref(0);
  const page_ = ref(1);
  const page_size_ = ref(DOWNLOAD_PAGE_SIZE_DEFAULT);
  const status_counts_ = refobj(empty_status_counts());
  const active_status_ = ref("total");
  const initial_ = ref(true);
  const loading_ = ref(false);
  const error_ = ref("");
  const list_render_enabled_ = ref(true);
  const selected_task_ids_ = refarr([]);
  const delete_task_ = ref(null);
  const delete_task_ids_ = refarr([]);
  const delete_delete_files_ = ref(true);
  const deleting_task_ = ref(false);
  const clearing_tasks_ = ref(false);
  const transcript_jobs_ = refobj({});
  const transcript_title_ = ref("文案提取");
  const transcript_action_label_ = ref("开始提取");
  const transcript_text_ = ref("");
  const transcript_message_ = ref("");
  const transcript_path_ = ref("");
  const transcript_task_id_ = ref("");
  const audio_jobs_ = refobj({});
  const audio_title_ = ref("音频提取");
  const audio_message_ = ref("");
  const audio_path_ = ref("");
  const audio_task_id_ = ref("");
  const audio_status_ = ref("idle");
  const audio_action_label_ = ref("开始分离");
  const audio_stems_ = refobj({ original: "", vocals: "", music: "" });
  let audio_sequence = 0;
  let audio_timer = null;
  const reverse_jobs_ = refobj({});
  const reverse_title_ = ref("视频反推");
  const reverse_action_label_ = ref("开始反推");
  const reverse_text_ = ref("");
  const reverse_message_ = ref("");
  const reverse_path_ = ref("");
  const reverse_vlm_ = ref(false);
  const reverse_vlm_frames_ = ref("3");
  const reverse_task_id_ = ref("");
  let reverse_sequence = 0;
  let reverse_timer = null;
  const white_model_jobs_ = refobj({});
  const white_model_title_ = ref("转白模");
  const white_model_message_ = ref("");
  const white_model_error_ = ref("");
  const white_model_path_ = ref("");
  const white_model_url_ = ref("");
  const white_model_progress_ = ref(-1);
  const white_model_contrast_ = ref(50);
  const white_model_relief_ = ref(30);
  const white_model_detail_ = ref(640);
  const white_model_source_ = ref("");
  const white_model_task_id_ = ref("");
  let white_model_apply_settings = false;
  const remake_jobs_ = refobj({});
  const remake_page_label_ = ref("视频复刻");
  const remake_title_ = ref("视频复刻");
  const remake_message_ = ref("");
  const remake_error_ = ref("");
  const remake_path_ = ref("");
  const remake_url_ = ref("");
  const remake_progress_ = ref(-1);
  const remake_source_ = ref("");
  const remake_reference_ = ref({ source: true, white: false, whiteReady: false, model: "mu-video" });
  const remake_image_name_ = ref("可以不选参考图");
  const remake_shots_ = ref([]);
  const remake_story_rows_ = ref([]);
  const remake_story_busy_map_ = ref({});
  const remake_board_preview_ = ref(null);
  const remake_shot_mode_ = ref("scene");
  const remake_cut_step_ = ref(5);
  const remake_cut_busy_ = ref(false);
  const remake_cuts_ = ref([]);
  const remake_cut_message_ = ref("按 5 秒、10 秒或 15 秒切开后，每一段可以预览。");
  const remake_story_model_ = ref("gt-image");
  const remake_prompt_llm_ = ref("deepseek");
  const remake_story_refs_ = ref([]);
  const remake_shot_message_ = ref("拉片后关键帧会留在这里；点关键帧可勾选作生图参考，也可上方上传替换图。");
  const remake_shot_busy_ = ref(false);
  const remake_shot_phase_ = ref("");
  const remake_shot_id_ = ref("");
  let remake_shot_frames = [];
  const remake_story_prompts = Object.create(null);
  const remake_story_video_prompts = Object.create(null);
  const remake_story_scripts = Object.create(null);
  const remake_story_frame_ref_selected = Object.create(null);
  const remake_story_result_ref_selected = Object.create(null);
  const remake_story_result_ref_paths = Object.create(null);
  const REMAKE_STORY_REF_MAX = 5;
  const remake_story_script_ = ref("");
  const remake_prompt_ = ref("");
  const remake_note_ = ref("");
  const remake_task_id_ = ref("");
  let remake_image_file = null;
  let remake_sequence = 0;
  let remake_shots_sequence = 0;
  let remake_timer = null;
  let remake_fill_from_reverse = false;
  const remake_reverse_label_ = ref("视频反推");
  const file_url_ = ref("");
  const file_url_title_ = ref("视频地址");
  let transcript_sequence = 0;
  let white_model_sequence = 0;
  let white_model_timer = null;
  let live_refresh_timer = null;
  let live_refresh_inflight = false;
  const create_task_text_ = ref("");
  const create_task_filename_ = ref("");
  const create_platform_text_ = ref("");
  const create_platform_json_ = ref("");
  const create_platform_download_dir_ = ref("");
  const create_platform_filename_ = ref("");
  const create_platform_download_cover_ = ref(false);
  const creating_task_ = ref(false);
  const create_task_preview_ = ref(null);
  const create_platform_preview_ = ref(null);
  const preview_task_id_ = ref("");
  const overwrite_ = refobj({ value: "overwrite" });
  const overwrite_apply_all_ = ref(false);
  const overwrite_processing_ = ref(false);
  const overwrite_conflict_ = refobj({ index: 0, total: 0, name: "" });
  const disposables = [];
  let list_view_element = null;
  let selection_anchor_task_id = null;
  let pending_create_object = null;
  let started = false;
  let disposed = false;
  let request_sequence = 0;
  let scroll_top = 0;

  const selected_task_count_ = computed(
    selected_task_ids_,
    (ids) => (ids || []).length,
  );
  const pending_delete_task_count_ = combine(
    { ids: delete_task_ids_, task: delete_task_ },
    (state) => {
      if (state.ids && state.ids.length) return state.ids.length;
      return state.task ? 1 : 0;
    },
  );
  const page_count_ = combine(
    { total: filtered_task_count_, pageSize: page_size_ },
    (state) =>
      Math.max(1, Math.ceil(state.total / Math.max(1, state.pageSize))),
  );
  const range_text_ = combine(
    {
      total: filtered_task_count_,
      page: page_,
      pageSize: page_size_,
      count: computed(tasks_, (tasks) => tasks.length),
    },
    (state) => {
      if (!state.total || !state.count) {
        return `共 ${state.total || 0} 条`;
      }
      const start = (state.page - 1) * state.pageSize + 1;
      return `第 ${start}-${start + state.count - 1} 条，共 ${state.total} 条`;
    },
  );
  const loaded_task_selection_ = combine(
    {
      tasks: tasks_,
      selected_ids: selected_task_ids_,
    },
    (data) => {
      const task_ids = [];
      (data.tasks || []).forEach((task) => {
        const id = task_identifier(task);
        if (
          !task ||
          task.__placeholder ||
          id === undefined ||
          id === null ||
          id === ""
        ) {
          return;
        }
        if (!task_ids.some((task_id) => task_id === id)) {
          task_ids.push(id);
        }
      });
      const selected_ids = data.selected_ids || [];
      const selected = task_ids.filter((id) => {
        return selected_ids.some((selected_id) => selected_id === id);
      }).length;
      return {
        total: task_ids.length,
        selected,
        checked: task_ids.length > 0 && selected === task_ids.length,
        indeterminate: selected > 0 && selected < task_ids.length,
      };
    },
  );
  const list_status_ = combine(
    {
      initial: initial_,
      error: error_,
      tasks: tasks_,
    },
    (state) => {
      if (state.initial) return "initial";
      if (state.error) return "error";
      return state.tasks.length > 0 ? "normal" : "empty";
    },
  );

  const methods = {};
  const ui = {
    btn_refresh_tasks$: new Timeless.vm.ButtonCore({
      variant: "outline",
      onClick() {
        return methods.refreshTasks();
      },
    }),
    btn_start_all_tasks$: new Timeless.vm.ButtonCore({
      variant: "primary",
      onClick() {
        return methods.startAllTasks();
      },
    }),
    btn_pause_all_tasks$: new Timeless.vm.ButtonCore({
      variant: "outline",
      onClick() {
        return methods.pauseAllTasks();
      },
    }),
    btn_clear_tasks$: new Timeless.vm.ButtonCore({
      variant: "danger",
      onClick() {
        return methods.requestClearTasks(false);
      },
    }),
    btn_delete_selected_tasks$: new Timeless.vm.ButtonCore({
      variant: "danger",
      onClick() {
        return methods.requestDeleteSelectedTasks(false);
      },
    }),
    input_create_task_url$: new Timeless.vm.InputCore({
      defaultValue: create_task_text_.value,
      placeholder: "请输入下载地址，例如 https://example.com/file.mp4",
      type: "url",
      allowClear: true,
      autoFocus: true,
      onChange(value) {
        methods.setCreateTaskText(value);
      },
    }),
    input_create_task_filename$: new Timeless.vm.InputCore({
      defaultValue: create_task_filename_.value,
      placeholder: "自动识别，可手动修改",
      allowClear: true,
      onChange(value) {
        create_task_filename_.as(value || "");
      },
    }),
    input_create_platform$: new Timeless.vm.InputCore({
      defaultValue: create_platform_text_.value,
      placeholder: "如 wx_channels、bilibili",
      allowClear: true,
      autoFocus: true,
      onChange(value) {
        create_platform_text_.as(value || "");
      },
    }),
    input_create_platform_json$: new Timeless.vm.InputCore({
      defaultValue: create_platform_json_.value,
      placeholder: '平台内容原始 JSON，如 {"feed_id":"xxx"}',
      allowClear: false,
      onChange(value) {
        create_platform_json_.as(value || "");
      },
    }),
    input_create_platform_download_dir$: new Timeless.vm.InputCore({
      defaultValue: create_platform_download_dir_.value,
      placeholder: "留空则使用默认下载目录",
      allowClear: true,
      onChange(value) {
        create_platform_download_dir_.as(value || "");
      },
    }),
    input_create_platform_filename$: new Timeless.vm.InputCore({
      defaultValue: create_platform_filename_.value,
      placeholder: "留空则自动命名",
      allowClear: true,
      onChange(value) {
        create_platform_filename_.as(value || "");
      },
    }),
    createTaskDialog$: new Timeless.vm.DialogCore({
      closeable: true,
      onOk() {
        return methods.confirmCreateTask();
      },
    }),
    createPlatformTaskDialog$: new Timeless.vm.DialogCore({
      closeable: true,
      onOk() {
        return methods.confirmCreatePlatformTask();
      },
    }),
    createTaskPreviewDialog$: new Timeless.vm.DialogCore({
      closeable: true,
      onOk() {
        return methods.confirmCreateTaskFromPreview();
      },
    }),
    createPlatformTaskPreviewDialog$: new Timeless.vm.DialogCore({
      closeable: true,
      onOk() {
        return methods.confirmCreatePlatformTaskFromPreview();
      },
    }),
    taskPreviewDrawer$: new Timeless.vm.DialogCore({
      title: "任务详情",
      closeable: true,
      footer: false,
    }),
    deleteConfirmDialog$: new Timeless.vm.DialogCore({
      onOk() {
        return methods.confirmDeleteTask();
      },
    }),
    clearConfirmDialog$: new Timeless.vm.DialogCore({
      onOk() {
        return methods.confirmClearTasks();
      },
    }),
    overwriteConfirmDialog$: new Timeless.vm.DialogCore({
      onOk() {
        return methods.confirmOverwriteDownloadConflict();
      },
    }),
    singleOverwriteConfirmDialog$: new Timeless.vm.DialogCore({
      onOk() {
        return methods.confirmOverwriteDownloadConflict();
      },
    }),
    batchOverwriteConfirmDialog$: new Timeless.vm.DialogCore({
      onOk() {
        return methods.confirmOverwriteDownloadConflict();
      },
    }),
    transcriptDialog$: new Timeless.vm.DialogCore({
      closeable: true,
      footer: false,
    }),
    audioDialog$: new Timeless.vm.DialogCore({
      closeable: true,
      footer: false,
    }),
    fileUrlDialog$: new Timeless.vm.DialogCore({
      closeable: true,
      footer: false,
    }),
    btn_file_url_copy$: new Timeless.vm.ButtonCore({
      variant: "outline",
      onClick() {
        return methods.copyTaskFileURL();
      },
    }),
    btn_transcript_copy$: new Timeless.vm.ButtonCore({
      variant: "outline",
      disabled: true,
      onClick() {
        return methods.copyTranscript();
      },
    }),
    btn_transcript_rerun$: new Timeless.vm.ButtonCore({
      variant: "outline",
      disabled: true,
      onClick() {
        return methods.rerunTranscript();
      },
    }),
    btn_audio_original$: new Timeless.vm.ButtonCore({
      variant: "outline",
      disabled: true,
      onClick() {
        return methods.downloadAudioStem("original");
      },
    }),
    btn_audio_vocals$: new Timeless.vm.ButtonCore({
      variant: "outline",
      disabled: true,
      onClick() {
        return methods.downloadAudioStem("vocals");
      },
    }),
    btn_audio_music$: new Timeless.vm.ButtonCore({
      variant: "outline",
      disabled: true,
      onClick() {
        return methods.downloadAudioStem("music");
      },
    }),
    btn_audio_rerun$: new Timeless.vm.ButtonCore({
      variant: "outline",
      disabled: true,
      onClick() {
        return methods.rerunAudioStems();
      },
    }),
    reverseDialog$: new Timeless.vm.DialogCore({
      closeable: true,
      footer: false,
    }),
    btn_reverse_copy$: new Timeless.vm.ButtonCore({
      variant: "outline",
      disabled: true,
      onClick() {
        return methods.copyReverse();
      },
    }),
    btn_reverse_open$: new Timeless.vm.ButtonCore({
      variant: "outline",
      disabled: true,
      onClick() {
        return methods.openReverseReport();
      },
    }),
    btn_reverse_rerun$: new Timeless.vm.ButtonCore({
      variant: "outline",
      disabled: true,
      onClick() {
        return methods.rerunReverse();
      },
    }),
    whiteModelDialog$: new Timeless.vm.DialogCore({
      closeable: true,
      footer: false,
    }),
    btn_white_model_run$: new Timeless.vm.ButtonCore({
      variant: "outline",
      disabled: true,
      onClick() {
        return methods.runWhiteModel();
      },
    }),
    btn_white_model_download$: new Timeless.vm.ButtonCore({
      variant: "outline",
      disabled: true,
      onClick() {
        return methods.downloadWhiteModel();
      },
    }),
    remakeDialog$: new Timeless.vm.DialogCore({
      closeable: true,
      footer: false,
    }),
    btn_remake_prompt$: new Timeless.vm.ButtonCore({
      variant: "outline",
      disabled: true,
      onClick() {
        return methods.runRemakeReverse();
      },
    }),
    btn_remake_reverse_report$: new Timeless.vm.ButtonCore({
      variant: "outline",
      disabled: true,
      onClick() {
        return methods.openRemakeReverseReport();
      },
    }),
    btn_remake_run$: new Timeless.vm.ButtonCore({
      variant: "outline",
      disabled: true,
      onClick() {
        return methods.runRemake();
      },
    }),
    btn_remake_download$: new Timeless.vm.ButtonCore({
      variant: "outline",
      disabled: true,
      onClick() {
        return methods.downloadRemake();
      },
    }),
    input_remake_note$: new Timeless.vm.InputCore({
      defaultValue: "",
      allowClear: false,
      ignoreEnterEvent: true,
      placeholder: "写下你想要的画面，例如人物在做什么、什么语气、什么风格。留空则按参考图和原始视频来写。",
      onChange(value) {
        remake_note_.as(value);
      },
    }),
  };

  function bind_ui_input(input, source) {
    const unlisten = source.subscribe({
      onChange(value) {
        if (input.value !== value) {
          input.setValue(value, { silence: true });
        }
      },
    });
    if (typeof unlisten === "function") {
      disposables.push(unlisten);
    }
  }

  bind_ui_input(ui.input_create_task_url$, create_task_text_);
  bind_ui_input(ui.input_create_task_filename$, create_task_filename_);
  bind_ui_input(ui.input_create_platform$, create_platform_text_);
  bind_ui_input(ui.input_create_platform_json$, create_platform_json_);
  bind_ui_input(
    ui.input_create_platform_download_dir$,
    create_platform_download_dir_,
  );
  bind_ui_input(
    ui.input_create_platform_filename$,
    create_platform_filename_,
  );

  function page_request_options(target_page) {
    const options = {
      all: false,
      page: Math.max(1, Number(target_page) || 1),
      page_size: page_size_.value,
    };
    const status = server_status_filter(active_status_.value);
    if (status) options.status = status;
    return options;
  }

  function apply_list_meta(meta) {
    if (!meta || typeof meta !== "object") return;
    const counts = normalize_server_status_counts(meta.stats);
    const response_total = Math.max(0, Number(meta.total) || 0);
    const filtered_total =
      response_total || Math.max(0, Number(counts[active_status_.value]) || 0);
    const response_page = Math.max(1, Number(meta.page) || page_.value || 1);
    const response_page_size = Math.max(
      1,
      Number(meta.page_size) || page_size_.value,
    );
    if (!counts.total && active_status_.value === "total") {
      counts.total = response_total;
    }
    task_count_.as(counts.total);
    filtered_task_count_.as(filtered_total);
    page_.as(response_page);
    page_size_.as(response_page_size);
    status_counts_.as(counts);
  }

  function rebuild_derived_state() {
    if (disposed) return;
    const domain_tasks = (downloader.task_list.value || []).filter((task$) => {
      const id = task_identifier(task$);
      return id !== undefined && id !== null && id !== "";
    });

    const valid_ids = domain_tasks.map(task_identifier);
    const selected_ids = (selected_task_ids_.value || []).filter((id) => {
      return valid_ids.some((valid_id) => valid_id === id);
    });
    if (selected_ids.length !== selected_task_ids_.value.length) {
      selected_task_ids_.as(selected_ids);
    }
    // Keep DownloadTaskModel instances intact. Their `state.*` refs drive row
    // updates without rebuilding plain records for every progress event.
    tasks_.assign(domain_tasks);
  }

  function task_is_downloading(task$) {
    const status =
      task$ && task$.state && task$.state.status && task$.state.status.value;
    return normalize_download_status(status) === "running";
  }

  function visible_download_is_live() {
    if (active_status_.value === "running") return true;
    return (tasks_.value || []).some(task_is_downloading);
  }

  function stop_live_refresh() {
    if (live_refresh_timer !== null) {
      clearInterval(live_refresh_timer);
      live_refresh_timer = null;
    }
  }

  function start_live_refresh() {
    stop_live_refresh();
    live_refresh_timer = setInterval(() => {
      if (disposed || live_refresh_inflight || loading_.value) return;
      if (!visible_download_is_live()) return;
      live_refresh_inflight = true;
      Promise.resolve(load_page(page_.value, { silent: true })).finally(() => {
        live_refresh_inflight = false;
      });
    }, 1000);
  }

  async function load_page(target_page = page_.value, load_options = {}) {
    const silent = load_options.silent === true;
    const requested_page = Math.max(1, Number(target_page) || 1);
    const sequence = ++request_sequence;
    const options = page_request_options(requested_page);
    if (!silent) loading_.as(true);
    try {
      let meta;
      if (typeof downloader.loadPage === "function") {
        meta = await downloader.loadPage(options);
      } else if (
        downloader.handler &&
        typeof downloader.handler.fetch_task_page === "function" &&
        typeof downloader.handler.replace_server_tasks === "function"
      ) {
        const request_options = { ...options };
        delete request_options.all;
        const data = await downloader.handler.fetch_task_page(request_options);
        if (sequence !== request_sequence || disposed) return null;
        downloader.handler.replace_server_tasks(data.records || []);
        meta = data;
      } else {
        await downloader.refresh(options);
        meta = downloader.list_meta && downloader.list_meta.value;
      }
      if (sequence !== request_sequence || disposed) return null;
      const meta_counts = normalize_server_status_counts(meta && meta.stats);
      const total =
        Math.max(0, Number(meta && meta.total) || 0) ||
        Math.max(0, Number(meta_counts[active_status_.value]) || 0);
      const page_size = Math.max(
        1,
        Number(meta && meta.page_size) || page_size_.value,
      );
      const last_page = Math.max(1, Math.ceil(total / page_size));
      if (requested_page > last_page) {
        return load_page(last_page, load_options);
      }
      sync_domain_tasks();
      apply_list_meta(meta);
      error_.as("");
      return tasks_;
    } catch (error) {
      if (sequence === request_sequence) {
        error_.as(
          (error && error.message) || String(error || "获取下载任务失败"),
        );
        report_error(error, "获取下载任务失败");
      }
      return null;
    } finally {
      if (sequence === request_sequence && !silent) {
        loading_.as(false);
        initial_.as(false);
      }
    }
  }

  function sync_domain_tasks() {
    rebuild_derived_state();
  }

  function domain_task(value) {
    if (value && value.state && value.state.id) return value;
    return downloader.get(task_identifier(value));
  }

  function report_error(error, fallback) {
    const message = (error && error.message) || String(error || fallback);
    DLUtils.error({ msg: message || fallback });
    return error;
  }

  async function run_task_action(value, action, fallback, refresh_page = true) {
    const task$ = domain_task(value);
    if (
      !task$ ||
      !task$.methods ||
      typeof task$.methods[action] !== "function"
    ) {
      report_error(null, "下载任务不存在");
      return null;
    }
    try {
      const result = await task$.methods[action]();
      if (refresh_page) await load_page(page_.value);
      return result;
    } catch (error) {
      report_error(error, fallback);
      return null;
    }
  }

  function set_status_filter(status) {
    const value =
      status === "total" ||
      Object.prototype.hasOwnProperty.call(DOWNLOAD_SERVER_STATUS_FILTERS, status)
        ? status
        : "total";
    active_status_.as(value);
    page_.as(1);
    reset_list_scroll();
    return load_page(1);
  }

  function reset_list_scroll() {
    scroll_top = 0;
    if (list_view_element) list_view_element.scrollTop = 0;
  }

  function change_page(target_page) {
    const page = Math.min(
      page_count_.value,
      Math.max(1, Number(target_page) || 1),
    );
    if (page === page_.value || loading_.value) return null;
    reset_list_scroll();
    return load_page(page);
  }

  function previous_page() {
    return change_page(page_.value - 1);
  }

  function next_page() {
    return change_page(page_.value + 1);
  }

  function refresh_tasks() {
    page_.as(1);
    reset_list_scroll();
    return load_page(1);
  }

  function start_task(task) {
    return run_task_action(task, "start", "开始下载任务失败");
  }

  function pause_task(task) {
    return run_task_action(task, "pause", "暂停下载任务失败");
  }

  function resume_task(task) {
    return run_task_action(task, "resume", "继续下载任务失败");
  }

  function retry_task(task) {
    return run_task_action(task, "retry", "重试下载任务失败");
  }

  function task_file_href(path, download) {
    const params = new URLSearchParams();
    params.set("path", path);
    if (download) params.set("download", "1");
    const origin =
      typeof window.server_media_origin === "function"
        ? window.server_media_origin()
        : window.location.origin;
    return `${origin}/api/file?${params.toString()}`;
  }

  function show_task_file_url(task) {
    const raw = task_snapshot(task);
    const source_url = task_source_media_url(raw);
    if (!source_url) {
      if (window.DLUtils && DLUtils.toast) {
        DLUtils.toast("没有保存源站下载地址");
      }
      return false;
    }
    file_url_title_.as(String(raw.name || raw.title || "源站下载地址").trim() || "源站下载地址");
    file_url_.as(source_url);
    ui.fileUrlDialog$.show();
    return true;
  }

  function copy_task_file_url() {
    const text = String(file_url_.value || "").trim();
    if (!text) {
      if (window.DLUtils && DLUtils.toast) DLUtils.toast("没有可复制的视频地址");
      return false;
    }
    try {
      if (props.app && typeof props.app.copy === "function") {
        props.app.copy(text);
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        return false;
      }
      if (window.DLUtils && DLUtils.toast) DLUtils.toast("视频地址已复制");
      return true;
    } catch (error) {
      if (window.DLUtils && DLUtils.toast) DLUtils.toast("复制失败");
      return false;
    }
  }

  function task_download_path(raw) {
    const media_path = task_media_path(raw);
    if (media_path) return media_path;
    const files = task_record_files(raw);
    for (const file of files) {
      const path = String(
        (file && (file.file_path || file.filepath || file.local_path)) || "",
      ).trim();
      const status = String((file && file.status) || "").toLowerCase();
      if (path && status !== "deleted") return path;
    }
    return "";
  }

  function download_task_file(task) {
    const media_path = task_download_path(task_snapshot(task));
    if (!media_path) return false;
    const link = document.createElement("a");
    link.href = task_file_href(media_path, true);
    link.download = "";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    return true;
  }

  function set_audio_job(id, status) {
    if (!id) return;
    audio_jobs_.as({ ...audio_jobs_.value, [id]: status });
  }

  function download_local_path(path) {
    const media_path = String(path || "").trim();
    if (!media_path) return false;
    const link = document.createElement("a");
    link.href = task_file_href(media_path, true);
    link.download = "";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    return true;
  }

  function stop_audio_poll() {
    if (audio_timer) {
      window.clearInterval(audio_timer);
      audio_timer = null;
    }
  }

  function sync_audio_buttons(payload) {
    const paths = (payload && payload.paths) || {};
    const original = String(
      (payload && payload.original) || paths.original || audio_stems_.value.original || "",
    ).trim();
    const vocals = String(
      (payload && payload.vocals) || paths.vocals || audio_stems_.value.vocals || "",
    ).trim();
    const music = String(
      (payload && payload.music) || paths.music || audio_stems_.value.music || "",
    ).trim();
    audio_stems_.as({ original, vocals, music });
    if (original) ui.btn_audio_original$.enable();
    else ui.btn_audio_original$.disable();
    if (vocals) ui.btn_audio_vocals$.enable();
    else ui.btn_audio_vocals$.disable();
    if (music) ui.btn_audio_music$.enable();
    else ui.btn_audio_music$.disable();
  }

  function apply_audio_status(payload, sequence, id) {
    if (sequence !== audio_sequence) return;
    if (!payload) return;
    if (payload.ok === false && payload.status !== "error") {
      stop_audio_poll();
      audio_status_.as("error");
      audio_action_label_.as("重新分离");
      audio_message_.as(String(payload.error || payload.message || "音频提取失败"));
      set_audio_job(id, "error");
      sync_audio_buttons(payload);
      ui.btn_audio_rerun$.enable();
      return;
    }
    sync_audio_buttons(payload);
    if (payload.status === "running") {
      audio_status_.as("running");
      audio_action_label_.as("分离中");
      audio_message_.as(
        String(payload.message || "正在分离人声和配乐，短视频大约需要一两分钟…"),
      );
      set_audio_job(id, "loading");
      ui.btn_audio_rerun$.disable();
      return;
    }
    if (payload.status === "ready") {
      stop_audio_poll();
      audio_status_.as("ready");
      audio_action_label_.as("重新分离");
      audio_message_.as(String(payload.message || "人声分离完成，可以分别下载。"));
      set_audio_job(id, "ready");
      ui.btn_audio_rerun$.enable();
      return;
    }
    if (payload.status === "error") {
      stop_audio_poll();
      audio_status_.as("error");
      audio_action_label_.as("重新分离");
      audio_message_.as(String(payload.error || payload.message || "人声分离失败"));
      set_audio_job(id, "error");
      ui.btn_audio_rerun$.enable();
      return;
    }
    stop_audio_poll();
    audio_status_.as("idle");
    audio_action_label_.as("开始分离");
    audio_message_.as(String(payload.message || "点击「开始分离」提取原音、人声和配乐。"));
    set_audio_job(id, "");
    ui.btn_audio_rerun$.enable();
  }

  async function refresh_audio_stems(sequence, id) {
    const source = String(audio_path_.value || "").trim();
    if (!source) return null;
    try {
      const response = await fetch(
        `${task_console_origin()}/api/audio-stems?path=${encodeURIComponent(source)}`,
      );
      const payload = await response.json().catch(() => ({}));
      apply_audio_status(payload, sequence, id);
      return payload;
    } catch (_error) {
      if (sequence !== audio_sequence) return null;
      stop_audio_poll();
      audio_status_.as("error");
      audio_action_label_.as("重新分离");
      audio_message_.as("任务服务没有在运行。音频提取需要本机任务页保持启动。");
      set_audio_job(id, "error");
      ui.btn_audio_rerun$.enable();
      return null;
    }
  }

  function watch_audio_stems(id) {
    stop_audio_poll();
    const sequence = audio_sequence;
    audio_timer = window.setInterval(() => {
      refresh_audio_stems(sequence, id);
    }, 2500);
  }

  async function begin_audio_stems(id, media_path, force) {
    const sequence = ++audio_sequence;
    audio_path_.as(media_path);
    set_audio_job(id, "loading");
    ui.btn_audio_rerun$.disable();
    if (!force) {
      ui.btn_audio_vocals$.disable();
      ui.btn_audio_music$.disable();
    }
    audio_status_.as("running");
    audio_action_label_.as("分离中");
    audio_message_.as(force ? "正在重新分离…" : "正在查找已有分离结果…");
    try {
      if (!force) {
        const lookup = await fetch(
          `${task_console_origin()}/api/audio-stems?path=${encodeURIComponent(media_path)}`,
        );
        const found = await lookup.json().catch(() => ({}));
        if (sequence !== audio_sequence) return found;
        if (
          found &&
          (found.status === "ready" ||
            found.status === "running" ||
            found.status === "error" ||
            found.ok === false)
        ) {
          apply_audio_status(found, sequence, id);
          if (found.status === "running") watch_audio_stems(id);
          if (found.status === "ready" || found.status === "running" || found.status === "error") {
            return found;
          }
        }
      }
      audio_message_.as("正在准备人声分离…");
      const response = await fetch(`${task_console_origin()}/api/audio-stems`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: media_path,
          force: Boolean(force),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (sequence !== audio_sequence) return payload;
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || payload.message || `音频提取失败（${response.status}）`);
      }
      apply_audio_status(payload, sequence, id);
      if (payload && payload.status === "running") watch_audio_stems(id);
      return payload;
    } catch (error) {
      if (sequence !== audio_sequence) return null;
      const message = error && error.message ? error.message : String(error);
      const offline = /Failed to fetch|NetworkError|Load failed/i.test(message);
      stop_audio_poll();
      audio_status_.as("error");
      audio_action_label_.as("重新分离");
      audio_message_.as(
        offline
          ? "任务服务没有在运行。音频提取需要本机任务页保持启动。"
          : message,
      );
      set_audio_job(id, "error");
      ui.btn_audio_rerun$.enable();
      return null;
    }
  }

  async function extract_audio(task) {
    let raw = task_snapshot(task);
    const id = String(raw.id || "").trim();
    if (!id) return null;
    if (audio_jobs_.value[id] === "loading") {
      ui.audioDialog$.show();
      return null;
    }
    const title = String(raw.name || raw.title || "音频提取").trim() || "音频提取";
    const sequence = ++audio_sequence;
    stop_audio_poll();
    audio_task_id_.as(id);
    audio_title_.as(title);
    audio_stems_.as({ original: "", vocals: "", music: "" });
    audio_status_.as("idle");
    audio_action_label_.as("开始分离");
    audio_message_.as("点击「开始分离」提取原音、人声和配乐。");
    ui.btn_audio_original$.disable();
    ui.btn_audio_vocals$.disable();
    ui.btn_audio_music$.disable();
    ui.btn_audio_rerun$.disable();
    ui.audioDialog$.show();
    if (normalize_download_status(raw.status) !== "done") {
      audio_path_.as("");
      audio_message_.as("请等这条任务下载完成后再提取音频。");
      return null;
    }
    const resolved = await resolve_task_media_path(task, raw);
    if (sequence !== audio_sequence) return null;
    raw = resolved.raw;
    const media_path = resolved.media_path;
    audio_path_.as(media_path || "");
    if (!media_path) {
      audio_message_.as("本地视频路径还没同步，请先点刷新。");
      ui.btn_audio_rerun$.enable();
      return null;
    }
    try {
      const response = await fetch(
        `${task_console_origin()}/api/audio-stems?path=${encodeURIComponent(media_path)}`,
      );
      const found = await response.json().catch(() => ({}));
      if (sequence !== audio_sequence) return null;
      if (
        found &&
        (found.status === "ready" ||
          found.status === "running" ||
          found.status === "error" ||
          found.ok === false)
      ) {
        apply_audio_status(found, sequence, id);
        if (found.status === "running") watch_audio_stems(id);
        return found;
      }
      apply_audio_status(
        { ok: true, status: "idle", message: "点击「开始分离」提取原音、人声和配乐。" },
        sequence,
        id,
      );
      return found;
    } catch (_error) {
      if (sequence !== audio_sequence) return null;
      audio_message_.as("点击「开始分离」提取原音、人声和配乐。");
      ui.btn_audio_rerun$.enable();
      return null;
    }
  }

  function rerun_audio_stems() {
    const id = String(audio_task_id_.value || "").trim();
    const media_path = String(audio_path_.value || "").trim();
    if (!id || !media_path) return null;
    if (audio_status_.value === "running") return null;
    const force = audio_action_label_.value === "重新分离";
    return begin_audio_stems(id, media_path, force);
  }

  function download_audio_stem(kind) {
    const key = String(kind || "").trim();
    const path = String((audio_stems_.value && audio_stems_.value[key]) || "").trim();
    if (!path) {
      if (window.DLUtils && DLUtils.toast) {
        DLUtils.toast("这一轨还没准备好");
      }
      return false;
    }
    const ok = download_local_path(path);
    if (ok && window.DLUtils && DLUtils.toast) {
      const labels = { original: "原音", vocals: "人声", music: "配乐+环境声" };
      DLUtils.toast(`${labels[key] || "音频"}开始下载`);
    }
    return ok;
  }

  function task_snapshot(task) {
    const task$ = domain_task(task) || task;
    const raw_state = task$ && task$.state && task$.state.raw;
    const raw =
      raw_state && typeof raw_state === "object" && "value" in raw_state
        ? raw_state.value
        : raw_state;
    return raw && typeof raw === "object" ? raw : {};
  }

  function set_transcript_job(id, status) {
    if (!id) return;
    transcript_jobs_.as({ ...transcript_jobs_.value, [id]: status });
  }

  async function resolve_task_media_path(task, raw_input) {
    let raw = raw_input && typeof raw_input === "object" ? raw_input : task_snapshot(task);
    let media_path = task_media_path(raw);
    if (media_path) return { raw, media_path };
    // 实时任务对象有时还没带上 files[].file_path（常见为目录或空），先刷一次列表再取。
    try {
      await load_page(page_.value || 1);
    } catch (_error) {
      /* ignore */
    }
    raw = task_snapshot(task);
    media_path = task_media_path(raw);
    return { raw, media_path };
  }

  async function open_transcript(task) {
    let raw = task_snapshot(task);
    const id = String(raw.id || "").trim();
    if (!id) return null;
    if (transcript_jobs_.value[id] === "loading") {
      ui.transcriptDialog$.show();
      return null;
    }
    const same = String(transcript_task_id_.value || "") === id;
    const title = String(raw.name || raw.title || "文案提取").trim() || "文案提取";
    transcript_task_id_.as(id);
    transcript_title_.as(title);
    if (!same) {
      transcript_text_.as("");
      transcript_action_label_.as("开始提取");
      transcript_message_.as("点击「开始提取」开始识别口播。");
      ui.btn_transcript_copy$.disable();
    } else {
      transcript_action_label_.as(
        String(transcript_text_.value || "").trim() ? "重新提取" : "开始提取",
      );
    }
    ui.btn_transcript_rerun$.disable();
    ui.transcriptDialog$.show();
    if (normalize_download_status(raw.status) !== "done") {
      transcript_path_.as("");
      transcript_message_.as("请等这条任务下载完成后再提取文案。");
      return true;
    }
    const resolved = await resolve_task_media_path(task, raw);
    raw = resolved.raw;
    const media_path = resolved.media_path;
    transcript_path_.as(media_path);
    if (!media_path) {
      transcript_message_.as(
        "这条任务的本地音视频路径还没同步到列表，请点刷新后再提取文案。",
      );
      ui.btn_transcript_rerun$.enable();
      return true;
    }
    transcript_message_.as("点击「开始提取」开始识别口播。");
    show_saved_transcript(id, media_path);
    return true;
  }

  async function show_saved_transcript(id, media_path) {
    const sidecar = transcript_sidecar_path(media_path);
    if (!sidecar) return null;
    const sequence = ++transcript_sequence;
    if (!String(transcript_text_.value || "").trim()) {
      transcript_message_.as("正在读取本地文案…");
    }
    try {
      const response = await fetch(task_file_href(sidecar, false));
      if (sequence !== transcript_sequence) return null;
      if (!response.ok) {
        transcript_text_.as("");
        transcript_action_label_.as("开始提取");
        transcript_message_.as("点击「开始提取」开始识别口播。");
        ui.btn_transcript_copy$.disable();
        ui.btn_transcript_rerun$.enable();
        return null;
      }
      const text = readable_transcript(await response.text());
      if (sequence !== transcript_sequence) return null;
      if (!text) {
        transcript_action_label_.as("开始提取");
        transcript_message_.as("点击「开始提取」开始识别口播。");
        ui.btn_transcript_copy$.disable();
        ui.btn_transcript_rerun$.enable();
        return null;
      }
      transcript_text_.as(text);
      transcript_action_label_.as("重新提取");
      transcript_message_.as("已读取本地文案。可以重新提取。");
      finish_transcript(sequence, id, "ready", true);
      return text;
    } catch (_error) {
      if (sequence !== transcript_sequence) return null;
      transcript_action_label_.as("开始提取");
      transcript_message_.as("点击「开始提取」开始识别口播。");
      ui.btn_transcript_rerun$.enable();
      return null;
    }
  }

  function rerun_transcript() {
    const id = String(transcript_task_id_.value || "").trim();
    if (!id) return null;
    const task$ = downloader.get(id);
    const raw = task_snapshot(task$) || {};
    const again = transcript_action_label_.value === "重新提取";
    return load_transcript(
      {
        ...raw,
        id,
        name: transcript_title_.value,
        file_path: transcript_path_.value,
      },
      again,
    );
  }

  function copy_transcript() {
    const text = String(transcript_text_.value || "").trim();
    if (!text) return null;
    if (props.app && typeof props.app.copy === "function") {
      return props.app.copy(text);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return null;
  }

  async function load_transcript(raw, force) {
    const id = String(raw && raw.id ? raw.id : "").trim();
    if (!id) return null;
    const sequence = ++transcript_sequence;
    const title = String(raw.name || raw.title || "文案提取").trim() || "文案提取";
    transcript_task_id_.as(id);
    transcript_title_.as(title);
    transcript_text_.as("");
    transcript_message_.as("正在识别口播…");
    set_transcript_job(id, "loading");
    ui.btn_transcript_copy$.disable();
    ui.btn_transcript_rerun$.disable();
    ui.transcriptDialog$.show();

    try {
      const task$ = downloader.get(id);
      let snapshot = raw && typeof raw === "object" ? raw : task_snapshot(task$);
      if (normalize_download_status(snapshot.status) !== "done") {
        transcript_path_.as("");
        transcript_message_.as("请等这条任务下载完成后再提取文案。");
        finish_transcript(sequence, id, "empty");
        return null;
      }
      let media_path =
        task_media_path(snapshot) ||
        (is_media_file_path(transcript_path_.value) ? String(transcript_path_.value) : "");
      if (!media_path) {
        const resolved = await resolve_task_media_path(task$, snapshot);
        snapshot = resolved.raw;
        media_path = resolved.media_path;
      }
      if (!media_path) {
        transcript_path_.as("");
        transcript_message_.as(
          "这条任务的本地音视频路径还没同步到列表，请点刷新后再提取文案。",
        );
        finish_transcript(sequence, id, "empty");
        return null;
      }
      transcript_path_.as(media_path);
      transcript_message_.as("正在识别口播，长视频可能需要几分钟…");
      const response = await fetch(`${task_console_origin()}/api/transcript`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: media_path, force: Boolean(force) }),
      });
      const payload = await response.json().catch(() => ({}));
      if (sequence !== transcript_sequence) return payload;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || `文案提取失败（${response.status}）`);
      }
      transcript_text_.as(String(payload.text || ""));
      transcript_action_label_.as("重新提取");
      transcript_message_.as(String(payload.message || "文案已就绪"));
      finish_transcript(sequence, id, "ready", true);
      return payload;
    } catch (error) {
      if (sequence !== transcript_sequence) return null;
      const message = error && error.message ? error.message : String(error);
      const offline = /Failed to fetch|NetworkError|Load failed/i.test(message);
      transcript_action_label_.as("重新提取");
      transcript_message_.as(
        offline
          ? "任务服务没有在运行。文案提取需要本机任务页保持启动。"
          : message,
      );
      finish_transcript(sequence, id, "error");
      return null;
    }
  }

  function finish_transcript(sequence, id, status, can_copy = false) {
    if (sequence !== transcript_sequence) return;
    set_transcript_job(id, status);
    if (can_copy) ui.btn_transcript_copy$.enable();
    ui.btn_transcript_rerun$.enable();
  }

  function set_reverse_job(id, status) {
    if (!id) return;
    const jobs = { ...(reverse_jobs_.value || {}) };
    if (status) jobs[id] = status;
    else delete jobs[id];
    reverse_jobs_.as(jobs);
  }

  function stop_reverse_poll() {
    if (reverse_timer) window.clearInterval(reverse_timer);
    reverse_timer = null;
  }

  function apply_reverse_status(payload, sequence, id) {
    if (sequence !== reverse_sequence) return;
    if (!payload || payload.ok === false || payload.status === "error") {
      stop_reverse_poll();
      reverse_text_.as("");
      reverse_message_.as(
        (payload && (payload.message || payload.error)) || "视频反推失败",
      );
      reverse_action_label_.as("重新反推");
      set_reverse_job(id, "error");
      ui.btn_reverse_copy$.disable();
      ui.btn_reverse_open$.disable();
      ui.btn_reverse_rerun$.enable();
      if (remake_fill_from_reverse) {
        remake_fill_from_reverse = false;
        remake_reverse_label_.as("视频反推");
        remake_shot_busy_.as(false);
        remake_shot_phase_.as("");
        remake_shot_message_.as(
          (payload && (payload.message || payload.error)) || "视频反推失败",
        );
        sync_remake_run_button();
      }
      return;
    }
    if (payload.status === "running") {
      reverse_message_.as(payload.message || "正在反推视频…");
      set_reverse_job(id, "loading");
      ui.btn_reverse_copy$.disable();
      ui.btn_reverse_open$.disable();
      ui.btn_reverse_rerun$.disable();
      if (remake_fill_from_reverse) {
        remake_reverse_label_.as("反推中");
        remake_shot_busy_.as(true);
        remake_shot_phase_.as("reverse");
        remake_shot_message_.as(payload.message || "正在视频反推…");
        remake_message_.as(payload.message || "正在视频反推…");
        sync_remake_run_button();
      }
      return;
    }
    if (payload.status === "ready") {
      stop_reverse_poll();
      const preview = String(payload.text || "");
      reverse_text_.as(preview);
      reverse_action_label_.as("重新反推");
      reverse_message_.as(payload.message || "视频反推完成");
      set_reverse_job(id, "ready");
      if (preview.trim()) ui.btn_reverse_copy$.enable();
      else ui.btn_reverse_copy$.disable();
      ui.btn_reverse_open$.enable();
      ui.btn_reverse_rerun$.enable();
      ui.btn_remake_reverse_report$.enable();
      const remake_source = String(remake_source_.value || "").trim();
      const reverse_source = String(reverse_path_.value || "").trim();
      if (
        remake_fill_from_reverse ||
        (remake_source && reverse_source && remake_source === reverse_source)
      ) {
        remake_prompt_.as(preview);
      }
      if (remake_fill_from_reverse) {
        remake_fill_from_reverse = false;
        remake_reverse_label_.as("视频反推");
        remake_shot_busy_.as(false);
        remake_shot_phase_.as("");
        remake_shot_message_.as(payload.message || "视频反推完成。");
        remake_message_.as(payload.message || "视频反推完成。");
        sync_remake_run_button();
      }
      return;
    }
    stop_reverse_poll();
    reverse_text_.as("");
    reverse_action_label_.as("开始反推");
    reverse_message_.as(payload.message || "点击「开始反推」开始拆解这条视频。");
    set_reverse_job(id, "");
    ui.btn_reverse_copy$.disable();
    ui.btn_reverse_open$.disable();
    ui.btn_reverse_rerun$.enable();
  }

  async function refresh_reverse(sequence, id) {
    const source = String(reverse_path_.value || "").trim();
    if (!source) return null;
    try {
      const response = await fetch(
        `${task_console_origin()}/api/video-reverse?path=${encodeURIComponent(source)}`,
      );
      const payload = await response.json().catch(() => ({}));
      apply_reverse_status(payload, sequence, id);
      return payload;
    } catch (_error) {
      if (sequence !== reverse_sequence) return null;
      stop_reverse_poll();
      reverse_action_label_.as("重新反推");
      reverse_message_.as("任务服务没有在运行。视频反推需要本机任务页保持启动。");
      set_reverse_job(id, "error");
      ui.btn_reverse_rerun$.enable();
      return null;
    }
  }

  function watch_reverse(id) {
    stop_reverse_poll();
    const sequence = reverse_sequence;
    reverse_timer = window.setInterval(() => {
      refresh_reverse(sequence, id);
    }, 2500);
  }

  async function begin_reverse(id, media_path, force) {
    const sequence = ++reverse_sequence;
    reverse_path_.as(media_path);
    reverse_text_.as("");
    set_reverse_job(id, "loading");
    ui.btn_reverse_copy$.disable();
    ui.btn_reverse_open$.disable();
    ui.btn_reverse_rerun$.disable();
    reverse_message_.as(force ? "正在重新反推…" : "正在查找已有反推结果…");
    try {
      if (!force) {
        const lookup = await fetch(
          `${task_console_origin()}/api/video-reverse?path=${encodeURIComponent(media_path)}`,
        );
        const found = await lookup.json().catch(() => ({}));
        if (sequence !== reverse_sequence) return found;
        if (
          found &&
          (found.status === "ready" ||
            found.status === "running" ||
            found.status === "error" ||
            found.ok === false)
        ) {
          apply_reverse_status(found, sequence, id);
          if (found.status === "running") watch_reverse(id);
          return found;
        }
      }
      reverse_message_.as("正在准备反推…");
      const response = await fetch(`${task_console_origin()}/api/video-reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
          path: media_path,
          force: Boolean(force),
          use_vlm: reverse_vlm_.value !== false,
          vlm_images: reverse_vlm_frames_.value === "all" ? 0 : 3,
          prompt_llm: selected_prompt_llm(),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (sequence !== reverse_sequence) return payload;
      apply_reverse_status(payload, sequence, id);
      if (payload && payload.status === "running") watch_reverse(id);
      return payload;
    } catch (error) {
      if (sequence !== reverse_sequence) return null;
      const message = error && error.message ? error.message : String(error);
      const offline = /Failed to fetch|NetworkError|Load failed/i.test(message);
      stop_reverse_poll();
      reverse_message_.as(
        offline
          ? "任务服务没有在运行。视频反推需要本机任务页保持启动。"
          : message,
      );
      reverse_action_label_.as("重新反推");
      set_reverse_job(id, "error");
      ui.btn_reverse_rerun$.enable();
      return null;
    }
  }

  async function preview_reverse(id, media_path) {
    const sequence = ++reverse_sequence;
    reverse_path_.as(media_path);
    reverse_action_label_.as("开始反推");
    reverse_message_.as("点击「开始反推」开始拆解这条视频。");
    try {
      const lookup = await fetch(
        `${task_console_origin()}/api/video-reverse?path=${encodeURIComponent(media_path)}`,
      );
      const found = await lookup.json().catch(() => ({}));
      if (sequence !== reverse_sequence) return found;
      if (
        found &&
        (found.status === "ready" ||
          found.status === "running" ||
          found.status === "error" ||
          found.ok === false)
      ) {
        apply_reverse_status(found, sequence, id);
        if (found.status === "running") watch_reverse(id);
        return found;
      }
      ui.btn_reverse_rerun$.enable();
      return found;
    } catch (_error) {
      if (sequence !== reverse_sequence) return null;
      reverse_action_label_.as("开始反推");
      reverse_message_.as("点击「开始反推」开始拆解这条视频。");
      ui.btn_reverse_rerun$.enable();
      return null;
    }
  }

  function open_reverse(task) {
    const raw = task_snapshot(task);
    const id = String(raw.id || "").trim();
    if (!id) return null;
    if (reverse_jobs_.value[id] === "loading") {
      ui.reverseDialog$.show();
      if (!reverse_timer) watch_reverse(id);
      return null;
    }
    stop_reverse_poll();
    const title = String(raw.name || raw.title || "视频反推").trim() || "视频反推";
    reverse_task_id_.as(id);
    reverse_title_.as(title);
    reverse_text_.as("");
    reverse_action_label_.as("开始反推");
    reverse_message_.as("点击「开始反推」开始拆解这条视频。");
    ui.btn_reverse_copy$.disable();
    ui.btn_reverse_open$.disable();
    ui.btn_reverse_rerun$.disable();
    ui.reverseDialog$.show();
    if (normalize_download_status(raw.status) !== "done") {
      reverse_path_.as("");
      reverse_message_.as("请等这条任务下载完成后再反推。");
      set_reverse_job(id, "empty");
      return null;
    }
    const media_path = task_media_path(raw);
    if (!media_path) {
      reverse_path_.as("");
      reverse_message_.as("这条任务没有可反推的本地视频。");
      set_reverse_job(id, "empty");
      return null;
    }
    return preview_reverse(id, media_path);
  }

  function rerun_reverse() {
    const id = String(reverse_task_id_.value || "").trim();
    const media_path = String(reverse_path_.value || "").trim();
    if (!id || !media_path) return null;
    const again = reverse_action_label_.value === "重新反推";
    return begin_reverse(id, media_path, again);
  }

  function copy_reverse() {
    const text = String(reverse_text_.value || "").trim();
    if (!text) return null;
    if (props.app && typeof props.app.copy === "function") {
      return props.app.copy(text);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return null;
  }

  function open_reverse_report() {
    const media_path = String(reverse_path_.value || "").trim();
    if (!media_path) return null;
    const url = `${task_console_origin()}/api/video-reverse/report?path=${encodeURIComponent(media_path)}`;
    window.open(url, "_blank", "noopener");
    return true;
  }

  function open_remake_reverse_report() {
    const media_path = String(
      remake_source_.value || reverse_path_.value || "",
    ).trim();
    if (!media_path) return null;
    reverse_path_.as(media_path);
    const url = `${task_console_origin()}/api/video-reverse/report?path=${encodeURIComponent(media_path)}`;
    window.open(url, "_blank", "noopener");
    return true;
  }

  async function refresh_remake_reverse_report(media_path) {
    const path = String(media_path || remake_source_.value || "").trim();
    if (!path) {
      ui.btn_remake_reverse_report$.disable();
      return false;
    }
    try {
      const response = await fetch(
        `${task_console_origin()}/api/video-reverse?path=${encodeURIComponent(path)}`,
      );
      const payload = await response.json().catch(() => ({}));
      if (payload && payload.status === "ready") {
        reverse_path_.as(path);
        reverse_text_.as(String(payload.text || ""));
        remake_prompt_.as(String(payload.text || ""));
        ui.btn_remake_reverse_report$.enable();
        return true;
      }
      ui.btn_remake_reverse_report$.disable();
      return false;
    } catch (_error) {
      ui.btn_remake_reverse_report$.disable();
      return false;
    }
  }

  function set_white_model_job(id, status) {
    if (!id) return;
    white_model_jobs_.as({ ...white_model_jobs_.value, [id]: status });
  }

  function stop_white_model_poll() {
    if (white_model_timer) {
      clearInterval(white_model_timer);
      white_model_timer = null;
    }
  }

  function show_white_model_file(path, message) {
    white_model_path_.as(path);
    white_model_url_.as(`${task_file_href(path, false)}&t=${Date.now()}`);
    white_model_progress_.as(-1);
    white_model_error_.as("");
    white_model_message_.as(message || "已有白模视频");
    ui.btn_white_model_download$.enable();
    ui.btn_white_model_run$.enable();
  }

  function remember_white_model_settings(payload) {
    if (!white_model_apply_settings) return;
    const settings = payload && payload.settings;
    if (!settings || typeof settings !== "object") return;
    white_model_apply_settings = false;
    const contrast = Number(settings.contrast);
    const relief = Number(settings.relief);
    const detail = Number(settings.max_res);
    if (Number.isFinite(contrast)) {
      white_model_contrast_.as(Math.max(0, Math.min(100, Math.round(contrast))));
    }
    if (Number.isFinite(relief)) {
      white_model_relief_.as(Math.max(0, Math.min(100, Math.round(relief))));
    }
    if ([480, 640, 960].includes(detail)) white_model_detail_.as(detail);
  }

  function white_model_request_settings() {
    const contrast = Number(white_model_contrast_.value);
    const relief = Number(white_model_relief_.value);
    const detail = Number(white_model_detail_.value);
    return {
      contrast: Number.isFinite(contrast)
        ? Math.max(0, Math.min(100, Math.round(contrast)))
        : 40,
      relief: Number.isFinite(relief)
        ? Math.max(0, Math.min(100, Math.round(relief)))
        : 50,
      max_res: [480, 640, 960].includes(detail) ? detail : 640,
    };
  }

  function apply_white_model_status(payload, sequence, id) {
    if (sequence !== white_model_sequence) return;
    remember_white_model_settings(payload);
    if (!payload || payload.ok === false || payload.status === "error") {
      stop_white_model_poll();
      white_model_url_.as("");
      white_model_progress_.as(-1);
      const original = String(
        (payload && payload.error) || (payload && payload.message) || "转白模失败",
      );
      const explanation = String((payload && payload.explanation) || "").trim();
      white_model_message_.as(explanation || original);
      white_model_error_.as(explanation && explanation !== original ? original : "");
      set_white_model_job(id, "error");
      ui.btn_white_model_download$.disable();
      ui.btn_white_model_run$.enable();
      return;
    }
    if (payload.status === "running") {
      const progress = Number(payload.progress);
      white_model_progress_.as(Number.isFinite(progress) ? progress : 0);
      white_model_error_.as("");
      white_model_message_.as(payload.message || "正在转白模…");
      set_white_model_job(id, "loading");
      ui.btn_white_model_run$.disable();
      return;
    }
    if (payload.status === "ready" && payload.path) {
      stop_white_model_poll();
      show_white_model_file(payload.path, payload.message);
      show_cut_white(white_model_source_.value, payload.path);
      set_white_model_job(id, "ready");
      return;
    }
    stop_white_model_poll();
    white_model_url_.as("");
    white_model_path_.as("");
    white_model_progress_.as(-1);
    white_model_error_.as("");
    white_model_message_.as(payload.message || "点击「转白模」开始。");
    set_white_model_job(id, "");
    ui.btn_white_model_download$.disable();
    ui.btn_white_model_run$.enable();
  }

  async function refresh_white_model(sequence, id) {
    const source = String(white_model_source_.value || "").trim();
    if (!source) return null;
    try {
      const response = await fetch(
        `${task_console_origin()}/api/white-model?path=${encodeURIComponent(source)}`,
      );
      const payload = await response.json().catch(() => ({}));
      apply_white_model_status(payload, sequence, id);
      return payload;
    } catch (_error) {
      if (sequence !== white_model_sequence) return null;
      white_model_message_.as("任务服务没有在运行。转白模需要本机任务页保持启动。");
      set_white_model_job(id, "error");
      ui.btn_white_model_run$.enable();
      return null;
    }
  }

  function watch_white_model(id) {
    stop_white_model_poll();
    const sequence = white_model_sequence;
    white_model_timer = setInterval(() => {
      refresh_white_model(sequence, id);
    }, 2000);
  }

  function open_white_model(task) {
    const raw = task_snapshot(task);
    const id = String(raw.id || "").trim();
    if (!id) return null;
    stop_white_model_poll();
    const title = String(raw.name || raw.title || "转白模").trim() || "转白模";
    const media_path = task_media_path(raw);
    const same = String(white_model_task_id_.value || "") === id;
    white_model_task_id_.as(id);
    white_model_title_.as(title);
    white_model_source_.as(media_path);
    if (!same) {
      white_model_url_.as("");
      white_model_path_.as("");
      white_model_progress_.as(-1);
      white_model_error_.as("");
      white_model_contrast_.as(50);
      white_model_relief_.as(30);
      white_model_detail_.as(640);
      white_model_message_.as("点击「转白模」开始。");
      ui.btn_white_model_download$.disable();
    }
    white_model_apply_settings = true;
    const ready =
      normalize_download_status(raw.status) === "done" && Boolean(media_path);
    if (normalize_download_status(raw.status) !== "done") {
      white_model_message_.as("请等这条任务下载完成后再转白模。");
    } else if (!media_path) {
      white_model_message_.as("这条任务没有可转换的本地音视频。");
    }
    if (ready) ui.btn_white_model_run$.enable();
    else ui.btn_white_model_run$.disable();
    ui.whiteModelDialog$.show();
    if (!ready) return true;
    const sequence = ++white_model_sequence;
    refresh_white_model(sequence, id).then((payload) => {
      if (payload && payload.status === "running") watch_white_model(id);
    });
    return true;
  }

  async function run_white_model() {
    const id = String(white_model_task_id_.value || "").trim();
    const source = String(white_model_source_.value || "").trim();
    if (!id || !source) return null;
    stop_white_model_poll();
    const sequence = ++white_model_sequence;
    const force = Boolean(white_model_url_.value);
    white_model_progress_.as(0);
    white_model_error_.as("");
    white_model_message_.as("正在准备转白模…");
    set_white_model_job(id, "loading");
    ui.btn_white_model_run$.disable();
    ui.btn_white_model_download$.disable();
    if (force) {
      white_model_url_.as("");
      white_model_path_.as("");
    }
    try {
      const response = await fetch(`${task_console_origin()}/api/white-model`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: source, force, ...white_model_request_settings() }),
      });
      const payload = await response.json().catch(() => ({}));
      apply_white_model_status(payload, sequence, id);
      if (payload && payload.status === "running") watch_white_model(id);
      return payload;
    } catch (_error) {
      if (sequence !== white_model_sequence) return null;
      white_model_message_.as("任务服务没有在运行。转白模需要本机任务页保持启动。");
      set_white_model_job(id, "error");
      ui.btn_white_model_run$.enable();
      return null;
    }
  }

  function download_white_model() {
    const path = String(white_model_path_.value || "").trim();
    if (!path) return false;
    const link = document.createElement("a");
    link.href = task_file_href(path, true);
    link.download = "";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    return true;
  }

  function set_remake_job(id, status) {
    const jobs = { ...(remake_jobs_.value || {}) };
    if (status) jobs[id] = status;
    else delete jobs[id];
    remake_jobs_.as(jobs);
  }

  function stop_remake_poll() {
    if (remake_timer) window.clearTimeout(remake_timer);
    remake_timer = null;
  }

  function normalize_remake_reference(ready) {
    const current = {
      source: true,
      white: false,
      whiteReady: false,
      ...(remake_reference_.value || {}),
    };
    current.source = current.source !== false;
    if (!["hailuo", "hailuo-2-3", "buming-h3", "wan-3-0", "mu-video"].includes(current.model)) current.model = "mu-video";
    if (typeof ready === "boolean") current.whiteReady = ready;
    if (!current.whiteReady) current.white = false;
    return current;
  }

  function apply_remake_white_ready(ready) {
    remake_reference_.as(normalize_remake_reference(Boolean(ready)));
  }

  async function refresh_remake_white(source) {
    const path = String(source || "").trim();
    if (!path) {
      apply_remake_white_ready(false);
      return false;
    }
    try {
      const response = await fetch(
        `${task_console_origin()}/api/white-model?path=${encodeURIComponent(path)}`,
      );
      const payload = await response.json().catch(() => ({}));
      const ready = Boolean(payload && payload.ok && payload.status === "ready");
      apply_remake_white_ready(ready);
      return ready;
    } catch (_error) {
      apply_remake_white_ready(false);
      return false;
    }
  }

  function remake_request_flags() {
    const selected = normalize_remake_reference();
    if (
      selected.model === "hailuo" ||
      selected.model === "buming-h3" ||
      selected.model === "wan-3-0"
    ) {
      return {
        model: selected.model,
        use_original: Boolean(selected.source),
        use_white: Boolean(selected.white && selected.whiteReady),
      };
    }
    return {
      model: selected.model === "hailuo-2-3" ? "hailuo-2-3" : "mu-video",
      use_original: false,
      use_white: false,
    };
  }

  function sync_remake_run_button() {
    const running = remake_progress_.value >= 0 && remake_progress_.value < 100;
    const shot_busy = Boolean(remake_shot_busy_.value);
    if (running || shot_busy) ui.btn_remake_run$.disable();
    else ui.btn_remake_run$.enable();
    if (running || shot_busy) ui.btn_remake_prompt$.disable();
    else ui.btn_remake_prompt$.enable();
  }

  function apply_remake_status(payload, sequence, id) {
    if (sequence !== remake_sequence) return;
    if (payload && typeof payload.prompt === "string" && payload.prompt) {
      remake_prompt_.as(payload.prompt);
    }
    if (!payload || payload.ok === false) {
      const message = (payload && payload.error) || "视频复刻失败";
      remake_error_.as(message);
      remake_message_.as(message);
      remake_progress_.as(-1);
      set_remake_job(id, "error");
      sync_remake_run_button();
      return;
    }
    if (payload.status === "running") {
      remake_message_.as(payload.message || "正在生成 5 秒预览…");
      remake_progress_.as(Number(payload.progress) || 0);
      set_remake_job(id, payload.mode === "prompt" ? "" : "loading");
      ui.btn_remake_prompt$.disable();
      ui.btn_remake_run$.disable();
      ui.btn_remake_download$.disable();
      return;
    }
    if (payload.status === "prompt") {
      remake_message_.as(payload.message || "提示词已写好");
      remake_progress_.as(-1);
      set_remake_job(id, "");
      sync_remake_run_button();
      return;
    }
    if (payload.status === "ready" && payload.path) {
      remake_path_.as(payload.path);
      remake_url_.as(task_file_href(payload.path));
      remake_message_.as(payload.message || "5 秒预览已生成");
      remake_progress_.as(-1);
      set_remake_job(id, "ready");
      ui.btn_remake_download$.enable();
      sync_remake_run_button();
      return;
    }
    remake_message_.as(remake_idle_message());
    remake_progress_.as(-1);
    set_remake_job(id, "");
    sync_remake_run_button();
  }

  function remake_idle_message() {
    const label = String(remake_page_label_.value || "").trim();
    if (label === "视频复刻") return "可上传替换图，切割后按段复刻。";
    return "可先视频反推，再按镜生图。";
  }

  async function refresh_remake(sequence, id) {
    const source = String(remake_source_.value || "").trim();
    if (!source) return null;
    try {
      const response = await fetch(
        `${task_console_origin()}/api/video-remake?path=${encodeURIComponent(source)}`,
      );
      const payload = await response.json().catch(() => ({}));
      apply_remake_status(payload, sequence, id);
      return payload;
    } catch (_error) {
      if (sequence !== remake_sequence) return null;
      remake_message_.as("任务服务没有在运行。视频复刻需要本机任务页保持启动。");
      return null;
    }
  }

  function watch_remake(id) {
    stop_remake_poll();
    const tick = async () => {
      const sequence = remake_sequence;
      const payload = await refresh_remake(sequence, id);
      if (sequence !== remake_sequence) return;
      if (payload && payload.status === "running") {
        remake_timer = window.setTimeout(tick, 2000);
      }
    };
    remake_timer = window.setTimeout(tick, 2000);
  }

  function shot_caption(frame) {
    const time = Number(frame && frame.time);
    const clock = Number.isFinite(time) ? `${time.toFixed(1)} 秒` : "";
    const label = String((frame && frame.label) || "").trim();
    if (label && label !== clock) return clock ? `${clock} ${label}` : label;
    return clock || label || "关键帧";
  }

  function is_weak_story_prompt(text) {
    const raw = String(text || "").trim();
    return !raw || raw.startsWith("按参考图重绘这一镜头的分镜静帧");
  }

  function story_image_label(model) {
    const key = String(model || "").trim();
    if (key === "seedream") return "Seedream 5.0";
    if (key === "gt-image" || key === "gt-image-2" || key === "gpt-image-2") {
      return "GT Image 2";
    }
    if (key === "mu-image") return "MU 生图";
    if (key === "mj-img" || key === "mj") return "MJ";
    return "GT Image 2";
  }

  function pick_remake_story_model(value) {
    const raw = String(value || "").trim();
    if (raw === "seedream") remake_story_model_.as("seedream");
    else if (raw === "mj-img" || raw === "mj" || raw === "mj_imagine") {
      remake_story_model_.as("mj-img");
    } else if (raw === "mu-image" || raw === "muse-image") {
      remake_story_model_.as("mu-image");
    } else remake_story_model_.as("gt-image");
  }

  function story_prompt_llm_label(model) {
    const key = String(model || "").trim();
    if (key === "gt-5.5") return "GT-5.5";
    if (key === "deepseek") return "DeepSeek";
    return "Nemotron";
  }

  function pick_remake_prompt_llm(value) {
    const key = String(value || "").trim();
    if (key === "nemotron") remake_prompt_llm_.as("nemotron");
    else if (key === "gt-5.5") remake_prompt_llm_.as("gt-5.5");
    else remake_prompt_llm_.as("deepseek");
  }

  function selected_prompt_llm() {
    const key = String(remake_prompt_llm_.value || "").trim();
    if (key === "nemotron" || key === "gt-5.5") return key;
    return "deepseek";
  }

  function show_remake_story_refs(items) {
    const list = Array.isArray(items) ? items : [];
    remake_story_refs_.as(
      list
        .map((item, index) => {
          const id = String((item && item.id) || "").trim();
          const path = String((item && item.path) || "").trim();
          if (!id || !path) return null;
          return {
            id,
            path,
            url: `${task_file_href(path, false)}&t=${Date.now()}`,
            selected: item && item.selected !== false,
            rowKey: `${id}:${item && item.selected !== false ? "1" : "0"}:${index}`,
          };
        })
        .filter(Boolean),
    );
  }

  async function refresh_remake_story_refs(sourcePath) {
    const source = String(sourcePath || remake_source_.value || "").trim();
    if (!source) {
      remake_story_refs_.as([]);
      return null;
    }
    try {
      const response = await fetch(
        `${task_console_origin()}/api/video-remake/storyboard-refs?path=${encodeURIComponent(source)}`,
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload || payload.ok === false) {
        remake_story_refs_.as([]);
        return payload;
      }
      show_remake_story_refs(payload.items || []);
      return payload;
    } catch (_error) {
      remake_story_refs_.as([]);
      return null;
    }
  }

  function selected_upload_story_ref_ids() {
    return (remake_story_refs_.value || [])
      .filter((item) => item && item.selected !== false)
      .map((item) => String(item.id || "").trim())
      .filter(Boolean);
  }

  function selected_frame_story_ref_ids() {
    return Object.keys(remake_story_frame_ref_selected).filter(
      (id) => remake_story_frame_ref_selected[id],
    );
  }

  function selected_result_story_ref_ids() {
    return Object.keys(remake_story_result_ref_selected).filter(
      (id) => remake_story_result_ref_selected[id],
    );
  }

  function selected_story_ref_ids() {
    const uploads = selected_upload_story_ref_ids();
    const frames = selected_frame_story_ref_ids().map((id) => `shot:${id}`);
    // 生图：上传参考 + 首列关键帧；合计最多 5 张。
    return [...uploads, ...frames].slice(0, REMAKE_STORY_REF_MAX);
  }

  function selected_video_ref_ids(shotId) {
    const target = String(shotId || "").trim();
    const uploads = selected_upload_story_ref_ids();
    const use_result = Boolean(target && remake_story_result_ref_selected[target]);
    // 生成视频只带本行勾选的结果图，以及上传的参考图。
    return [...(use_result ? [`gen:${target}`] : []), ...uploads].slice(0, REMAKE_STORY_REF_MAX);
  }

  function selected_story_ref_count() {
    return (
      selected_upload_story_ref_ids().length +
      selected_frame_story_ref_ids().length +
      selected_result_story_ref_ids().length
    );
  }

  function clear_remake_story_frame_refs() {
    Object.keys(remake_story_frame_ref_selected).forEach((key) => {
      delete remake_story_frame_ref_selected[key];
    });
    Object.keys(remake_story_result_ref_selected).forEach((key) => {
      delete remake_story_result_ref_selected[key];
    });
    Object.keys(remake_story_result_ref_paths).forEach((key) => {
      delete remake_story_result_ref_paths[key];
    });
  }

  function mark_result_ref_selected(shotId, generatedPath) {
    const id = String(shotId || "").trim();
    if (!id) return;
    const path = String(generatedPath || "").trim();
    if (path) remake_story_result_ref_paths[id] = path;
    remake_story_result_ref_selected[id] = true;
  }

  function sync_result_ref_default(shotId, generatedPath) {
    const id = String(shotId || "").trim();
    if (!id) return false;
    const path = String(generatedPath || "").trim();
    if (!path) {
      delete remake_story_result_ref_paths[id];
      delete remake_story_result_ref_selected[id];
      return false;
    }
    const prev = String(remake_story_result_ref_paths[id] || "");
    // 新生成或换了结果图 → 默认勾选；用户手动取消后，同一张图不强制勾回。
    if (prev !== path || !Object.prototype.hasOwnProperty.call(remake_story_result_ref_selected, id)) {
      remake_story_result_ref_paths[id] = path;
      remake_story_result_ref_selected[id] = true;
      return true;
    }
    return Boolean(remake_story_result_ref_selected[id]);
  }

  function toggle_remake_story_ref(refId) {
    const id = String(refId || "").trim();
    if (!id) return;
    const current = (remake_story_refs_.value || []).find(
      (item) => String(item.id || "") === id,
    );
    const turning_on = !(current && current.selected !== false);
    if (turning_on && selected_story_ref_count() >= REMAKE_STORY_REF_MAX) {
      remake_shot_message_.as(
        `参考图最多 ${REMAKE_STORY_REF_MAX} 张（含上传、关键帧、结果图）。`,
      );
      return;
    }
    const next = (remake_story_refs_.value || []).map((item) => {
      if (String(item.id || "") !== id) return item;
      const selected = item.selected === false;
      return {
        ...item,
        selected,
        rowKey: `${id}:${selected ? "1" : "0"}`,
      };
    });
    remake_story_refs_.as(next);
    const source = String(remake_source_.value || "").trim();
    if (!source) return;
    fetch(`${task_console_origin()}/api/video-remake/storyboard-refs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: source,
        selected_ids: next
          .filter((item) => item.selected !== false)
          .map((item) => item.id),
      }),
    }).catch(() => {});
  }

  function toggle_remake_story_frame_ref(shotId) {
    const id = String(shotId || "").trim();
    if (!id) return;
    const turning_on = !remake_story_frame_ref_selected[id];
    if (turning_on && selected_story_ref_count() >= REMAKE_STORY_REF_MAX) {
      remake_shot_message_.as(
        `参考图最多 ${REMAKE_STORY_REF_MAX} 张（含上传、关键帧、结果图）。`,
      );
      return;
    }
    remake_story_frame_ref_selected[id] = turning_on;
    remake_story_rows_.as(
      (remake_story_rows_.value || []).map((row) => {
        if (String(row.id || "") !== id) return row;
        return {
          ...row,
          refSelected: turning_on,
          rowKey: `${id}:ref:${turning_on ? "1" : "0"}:${row.rowKey || ""}`,
        };
      }),
    );
    remake_shot_message_.as(
      turning_on
        ? `已选第 ${id} 镜关键帧作参考（${selected_story_ref_count()}/${REMAKE_STORY_REF_MAX}）。`
        : `已取消第 ${id} 镜关键帧参考（${selected_story_ref_count()}/${REMAKE_STORY_REF_MAX}）。`,
    );
  }

  function toggle_remake_story_result_ref(shotId) {
    const id = String(shotId || "").trim();
    if (!id) return;
    const row = (remake_story_rows_.value || []).find(
      (item) => String(item.id || "") === id,
    );
    if (!row || !String(row.generated || row.generatedUrl || "").trim()) {
      remake_shot_message_.as("这一镜还没有结果图，先生成分镜图。");
      return;
    }
    const turning_on = !remake_story_result_ref_selected[id];
    if (turning_on && selected_story_ref_count() >= REMAKE_STORY_REF_MAX) {
      remake_shot_message_.as(
        `参考图最多 ${REMAKE_STORY_REF_MAX} 张（含上传、关键帧、结果图）。`,
      );
      return;
    }
    remake_story_result_ref_selected[id] = turning_on;
    remake_story_rows_.as(
      (remake_story_rows_.value || []).map((item) => {
        if (String(item.id || "") !== id) return item;
        return {
          ...item,
          resultRefSelected: turning_on,
          rowKey: `${id}:gen:${turning_on ? "1" : "0"}:${item.rowKey || ""}`,
        };
      }),
    );
    remake_shot_message_.as(
      turning_on
        ? `已选第 ${id} 镜结果图作视频参考（${selected_story_ref_count()}/${REMAKE_STORY_REF_MAX}）。`
        : `已取消第 ${id} 镜结果图参考（${selected_story_ref_count()}/${REMAKE_STORY_REF_MAX}）。`,
    );
  }

  async function upload_remake_story_refs(fileList) {
    const source = String(remake_source_.value || "").trim();
    if (!source) {
      remake_shot_message_.as("先打开一条已下载视频，再上传替换图。");
      return null;
    }
    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length) return null;
    const current = remake_story_refs_.value || [];
    const room = Math.max(0, 5 - current.length);
    if (room <= 0) {
      remake_shot_message_.as("替换图最多 5 张。");
      return null;
    }
    const body = new FormData();
    body.append("path", source);
    files.slice(0, room).forEach((file, index) => {
      body.append(`image_${index}`, file, file.name || `ref-${index + 1}.jpg`);
    });
    try {
      const response = await fetch(
        `${task_console_origin()}/api/video-remake/storyboard-refs`,
        { method: "POST", body },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload || payload.ok === false) {
        remake_shot_message_.as((payload && payload.error) || "上传替换图失败");
        return payload;
      }
      show_remake_story_refs(payload.items || []);
      remake_shot_message_.as(
        `已上传替换图 ${(payload.items || []).length}/5。勾选后可用于片段复刻，也可和关键帧一起作生图参考。`,
      );
      return payload;
    } catch (_error) {
      remake_shot_message_.as("任务服务没有在运行。上传替换图需要本机任务页保持启动。");
      return null;
    }
  }

  async function remove_remake_story_ref(refId) {
    const source = String(remake_source_.value || "").trim();
    const id = String(refId || "").trim();
    if (!source || !id) return null;
    try {
      const response = await fetch(
        `${task_console_origin()}/api/video-remake/storyboard-refs`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: source, remove_id: id }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload || payload.ok === false) {
        remake_shot_message_.as((payload && payload.error) || "删除参考图失败");
        return payload;
      }
      show_remake_story_refs(payload.items || []);
      return payload;
    } catch (_error) {
      remake_shot_message_.as("任务服务没有在运行。删除参考图需要本机任务页保持启动。");
      return null;
    }
  }

  function is_pull_shot_message(text) {
    const raw = String(text || "").trim();
    if (!raw) return false;
    if (
      /分镜图已|分镜视频|提示词已|花费\s*¥|正在用|DeepSeek|MU 生图|Seedream|动态提示词|已从视频反推填充/.test(
        raw,
      )
    ) {
      return false;
    }
    return /抽出|拉片|情节|画面变化|没有文案|没有配置|反推/.test(raw);
  }


  function story_busy_phase(shotId) {
    const map = remake_story_busy_map_.value || {};
    return String(map[String(shotId || "")] || "");
  }

  function story_phase_from_mode(mode) {
    const chosen = String(mode || "").trim();
    if (chosen === "prompt") return "story-prompt";
    if (chosen === "script") return "story-script";
    if (chosen === "video") return "story-video";
    return "story";
  }

  function set_story_busy(shotId, phase) {
    const key = String(shotId || "");
    const next = { ...(remake_story_busy_map_.value || {}) };
    if (phase) next[key] = String(phase);
    else delete next[key];
    remake_story_busy_map_.as(next);
    show_remake_shots(remake_shot_frames, remake_shot_id_.value);
  }

  function clear_story_busy(shotId, phase) {
    const key = String(shotId || "");
    const current = story_busy_phase(key);
    if (phase && current && current !== phase) return;
    set_story_busy(key, "");
  }

  function any_story_busy() {
    return Object.keys(remake_story_busy_map_.value || {}).length > 0;
  }

  function apply_storyboard_payload_frames(payload) {
    if (!payload || !Array.isArray(payload.frames)) return false;
    (payload.frames || []).forEach((frame) => {
      const id = String((frame && frame.id) || "");
      const text = String((frame && frame.prompt) || "").trim();
      const video_text = String((frame && frame.video_prompt) || "").trim();
      const script_text = String((frame && frame.script) || "").trim();
      if (id && text && !is_weak_story_prompt(text)) {
        remake_story_prompts[id] = text;
      }
      if (id && video_text) {
        remake_story_video_prompts[id] = video_text;
      }
      if (id && script_text) {
        remake_story_scripts[id] = script_text;
      }
    });
    show_remake_shots(payload.frames, remake_shot_id_.value);
    sync_remake_story_script_text();
    if (payload && typeof payload.script === "string" && payload.script.trim()) {
      remake_story_script_.as(payload.script);
    }
    return true;
  }

  function story_running_note(job, shotId, phase) {
    const target = String(shotId || "").trim();
    const mode = String((job && job.mode) || "").trim();
    const note = String((job && job.message) || "").trim();
    if (note) return note;
    if (phase === "story-prompt" || mode === "prompt") {
      return `正在用 ${story_prompt_llm_label(selected_prompt_llm())} 写分镜提示词…`;
    }
    if (phase === "story-video" || mode === "video") {
      return target ? `正在生成第 ${target} 镜视频…` : "正在生成分镜视频…";
    }
    if (phase === "story-script" || mode === "script") {
      return target ? `正在写第 ${target} 镜分镜脚本…` : "正在写分镜脚本…";
    }
    return target
      ? `正在用 ${story_image_label(remake_story_model_.value)} 生成第 ${target} 镜…`
      : "正在生成分镜图…";
  }

  async function resume_remake_story_jobs(path, sequence) {
    const source = String(path || remake_source_.value || "").trim();
    if (!source) return [];
    const shots_sequence =
      Number.isFinite(sequence) ? sequence : remake_shots_sequence;
    try {
      const response = await fetch(
        `${task_console_origin()}/api/video-remake/storyboard?path=${encodeURIComponent(source)}`,
      );
      const payload = await response.json().catch(() => ({}));
      if (shots_sequence !== remake_shots_sequence) return [];
      if (String(remake_source_.value || "") !== source) return [];
      if (!payload || payload.ok === false) return [];
      apply_storyboard_payload_frames(payload);
      const jobs = Array.isArray(payload.jobs) ? payload.jobs.slice() : [];
      if (
        !jobs.some((job) => job && job.status === "running") &&
        payload.status === "running"
      ) {
        jobs.push({
          mode: payload.mode,
          shot_id: payload.shot_id,
          message: payload.message,
          status: "running",
          progress: payload.progress,
        });
      }
      const resumed = [];
      jobs.forEach((job) => {
        if (!job || job.status !== "running") return;
        const target = String(job.shot_id || "").trim();
        const phase = story_phase_from_mode(job.mode);
        if (story_busy_phase(target)) return;
        const note = story_running_note(job, target, phase);
        set_story_busy(target, phase);
        if (target) set_story_row_status(target, note);
        else {
          remake_shot_frames = (remake_shot_frames || []).map((frame) => ({
            ...frame,
            status: note,
          }));
        }
        remake_shot_message_.as(note);
        resumed.push({ shotId: target, phase });
        poll_remake_storyboard(source, target, phase);
      });
      if (resumed.length) {
        show_remake_shots(remake_shot_frames, remake_shot_id_.value);
        sync_remake_run_button();
      }
      return resumed;
    } catch (_error) {
      return [];
    }
  }

  function set_story_row_status(shotId, status) {
    const target = String(shotId || "").trim();
    const note = String(status || "").trim();
    if (!target || !note) return;
    remake_shot_frames = (remake_shot_frames || []).map((frame) => {
      if (String(frame.id || "") !== target) return frame;
      return { ...frame, status: note };
    });
  }

  function show_remake_shots(frames, selectedId) {
    const selected = String(selectedId || "");
    const busy_map = remake_story_busy_map_.value || {};
    remake_shot_frames = Array.isArray(frames) ? frames : [];
    remake_shots_.as(
      remake_shot_frames.map((frame) => {
        const picture = String(frame.path || "");
        return {
          id: String(frame.id || ""),
          path: picture,
          url: picture ? `${task_file_href(picture, false)}&t=${Date.now()}` : "",
          caption: shot_caption(frame),
          selected: String(frame.id || "") === selected,
        };
      }),
    );
    remake_story_rows_.as(
      remake_shot_frames.map((frame) => {
        const id = String(frame.id || "");
        const picture = String(frame.path || "");
        const generated = String(frame.generated || "").trim();
        const generated_paths = [];
        const raw_generateds = Array.isArray(frame.generateds) ? frame.generateds : [];
        raw_generateds.forEach((entry) => {
          const path = typeof entry === "string"
            ? String(entry || "").trim()
            : String((entry && (entry.path || entry.file)) || "").trim();
          if (path && !generated_paths.includes(path)) generated_paths.push(path);
        });
        if (generated && !generated_paths.includes(generated)) {
          generated_paths.unshift(generated);
        }
        const video = String(frame.video || "").trim();
        const saved = String(frame.prompt || "").trim();
        const saved_video = String(frame.video_prompt || "").trim();
        const raw_status = String(frame.status || "").trim();
        const status = /分镜脚本已写好/.test(raw_status) ? "" : raw_status;
        const saved_script = String(frame.script || "").trim();
        if (saved && !is_weak_story_prompt(saved)) {
          remake_story_prompts[id] = saved;
        } else if (saved && is_weak_story_prompt(remake_story_prompts[id] || "")) {
          remake_story_prompts[id] = "";
        } else if (!(id in remake_story_prompts)) {
          remake_story_prompts[id] = is_weak_story_prompt(saved) ? "" : saved;
        }
        if (saved_video) {
          remake_story_video_prompts[id] = saved_video;
        } else if (!(id in remake_story_video_prompts)) {
          remake_story_video_prompts[id] = remake_story_prompts[id] || "";
        }
        if (saved_script) {
          remake_story_scripts[id] = saved_script;
        } else if (!(id in remake_story_scripts)) {
          remake_story_scripts[id] = "";
        }
        const prompt = remake_story_prompts[id] || "";
        const video_prompt = remake_story_video_prompts[id] || "";
        const shot_script = remake_story_scripts[id] || "";
        const ref_selected = Boolean(remake_story_frame_ref_selected[id]);
        const result_ref_selected = Boolean(sync_result_ref_default(id, generated));
        const version = [
          prompt.length,
          prompt.slice(0, 16),
          video_prompt.length,
          video_prompt.slice(0, 16),
          generated ? "1" : "0",
          String(generated_paths.length),
          video ? "1" : "0",
          status.length,
          status.slice(0, 16),
          shot_script.length,
          shot_script.slice(0, 16),
          ref_selected ? "1" : "0",
          result_ref_selected ? "1" : "0",
        ].join(":");
        return {
          id,
          rowKey: `${id}:${version}`,
          path: picture,
          url: picture ? `${task_file_href(picture, false)}&t=${Date.now()}` : "",
          caption: shot_caption(frame),
          refSelected: ref_selected,
          resultRefSelected: result_ref_selected,
          prompt,
          videoPrompt: video_prompt,
          generated,
          generatedUrl: generated
            ? `${task_file_href(generated, false)}&t=${Date.now()}`
            : "",
          generatedItems: generated_paths.map((path, index) => ({
            path,
            url: `${task_file_href(path, false)}&t=${Date.now()}`,
            caption: `第 ${id} 镜 · ${index + 1}/${generated_paths.length}`,
          })),
          video,
          videoUrl: video ? `${task_file_href(video, false)}&t=${Date.now()}` : "",
          status,
          script: shot_script,
          busy: Boolean(busy_map[id]),
          busyPhase: String(busy_map[id] || ""),
        };
      }),
    );
  }

  function sync_remake_story_script_text() {
    const parts = (remake_shot_frames || [])
      .map((frame) => {
        const id = String((frame && frame.id) || "");
        return String(remake_story_scripts[id] || (frame && frame.script) || "").trim();
      })
      .filter(Boolean);
    remake_story_script_.as(parts.join("\n\n"));
  }

  function update_remake_story_script(shotId, script) {
    const id = String(shotId || "").trim();
    if (!id) return;
    remake_story_scripts[id] = String(script || "");
    remake_shot_frames = (remake_shot_frames || []).map((frame) => {
      if (String(frame.id || "") !== id) return frame;
      return { ...frame, script: remake_story_scripts[id] };
    });
    remake_story_rows_.as(
      (remake_story_rows_.value || []).map((row) => {
        if (row.id !== id) return row;
        const next = remake_story_scripts[id];
        return {
          ...row,
          script: next,
          rowKey: `${id}:s:${String(next.length)}:${next.slice(0, 24)}`,
        };
      }),
    );
    sync_remake_story_script_text();
  }

  function update_remake_story_prompt(shotId, prompt) {
    const id = String(shotId || "").trim();
    if (!id) return;
    remake_story_prompts[id] = String(prompt || "");
    if (!String(remake_story_video_prompts[id] || "").trim()) {
      remake_story_video_prompts[id] = remake_story_prompts[id];
    }
    remake_story_rows_.as(
      (remake_story_rows_.value || []).map((row) => {
        if (row.id !== id) return row;
        const next = remake_story_prompts[id];
        const video_prompt = remake_story_video_prompts[id] || "";
        return {
          ...row,
          prompt: next,
          videoPrompt: video_prompt,
          rowKey: `${id}:${String(next.length)}:${next.slice(0, 16)}:${String(video_prompt.length)}`,
        };
      }),
    );
  }

  function update_remake_story_video_prompt(shotId, prompt) {
    const id = String(shotId || "").trim();
    if (!id) return;
    remake_story_video_prompts[id] = String(prompt || "");
    remake_story_rows_.as(
      (remake_story_rows_.value || []).map((row) => {
        if (row.id !== id) return row;
        const next = remake_story_video_prompts[id];
        return {
          ...row,
          videoPrompt: next,
          rowKey: `${id}:v:${String(next.length)}:${next.slice(0, 24)}`,
        };
      }),
    );
  }

  function open_remake_board(board) {
    const kind =
      String((board && board.kind) || "").trim() === "video" ? "video" : "image";
    const shot_id = String((board && board.shotId) || "").trim();
    const picker = Boolean(board && board.picker);
    const selected_path = String((board && board.selectedPath) || "").trim();
    const items_raw = Array.isArray(board && board.items) ? board.items : [];
    const items = items_raw
      .map((item, index) => {
        const path = String((item && item.path) || "").trim();
        const url = String((item && item.url) || "").trim()
          || (path ? `${task_file_href(path, false)}&t=${Date.now()}` : "");
        if (!url) return null;
        return {
          url,
          path,
          caption: String((item && item.caption) || "").trim()
            || String((board && board.caption) || "").trim()
            || `图 ${index + 1}`,
          isSelected: Boolean(path && selected_path && path === selected_path),
        };
      })
      .filter(Boolean);
    let url = String((board && board.url) || "").trim();
    let path = String((board && board.path) || "").trim();
    let caption = String((board && board.caption) || "").trim();
    const index_raw = board && board.index;
    const has_explicit_index =
      index_raw !== undefined && index_raw !== null && String(index_raw) !== "";
    let index = has_explicit_index ? Math.max(0, Number(index_raw) || 0) : -1;
    if (!items.length) {
      if (!url) return;
      items.push({
        url,
        path,
        caption: caption || "分镜图",
        isSelected: Boolean(path && selected_path && path === selected_path),
      });
    }
    // 仅首次打开（未指定 index）时定位到当前选用图；点缩略图必须尊重传入 index。
    if (index < 0) {
      if (picker && selected_path) {
        const selected_index = items.findIndex(
          (item) => item.path === selected_path,
        );
        index = selected_index >= 0 ? selected_index : 0;
      } else {
        index = 0;
      }
    }
    if (index >= items.length) index = 0;
    const current = items[index] || items[0];
    remake_board_preview_.as({
      url: current.url,
      path: current.path,
      caption: current.caption,
      kind,
      shotId: shot_id,
      items,
      index,
      picker,
      selectedPath: selected_path,
    });
  }

  function open_remake_story_result_picker(shotId) {
    const id = String(shotId || "").trim();
    if (!id) return false;
    const current = (remake_story_rows_.value || []).find(
      (item) => String(item.id || "") === id,
    );
    if (!current || !current.generatedUrl) return false;
    const items =
      Array.isArray(current.generatedItems) && current.generatedItems.length
        ? current.generatedItems.map((item, index) => ({
            ...item,
            caption: item.caption || `第 ${id} 镜 · ${index + 1}`,
          }))
        : [
            {
              url: current.generatedUrl,
              path: current.generated,
              caption: `第 ${id} 镜结果图`,
            },
          ];
    open_remake_board({
      shotId: id,
      items,
      selectedPath: String(current.generated || "").trim(),
      picker: true,
      caption: `第 ${id} 镜结果图`,
    });
    return true;
  }

  function focus_remake_board(index) {
    const board = remake_board_preview_.value;
    if (!board || !Array.isArray(board.items) || !board.items.length) return;
    const total = board.items.length;
    const next = Math.max(0, Math.min(total - 1, Number(index) || 0));
    const current = board.items[next];
    if (!current) return;
    remake_board_preview_.as({
      ...board,
      index: next,
      url: current.url,
      path: current.path,
      caption: current.caption,
      picker: Boolean(board.picker),
      selectedPath: String(board.selectedPath || "").trim(),
    });
  }

  function step_remake_board(delta) {
    const board = remake_board_preview_.value;
    if (!board || !Array.isArray(board.items) || board.items.length < 2) return;
    const total = board.items.length;
    const next = (Number(board.index) || 0) + Number(delta || 0);
    const index = ((next % total) + total) % total;
    focus_remake_board(index);
  }

  function close_remake_board() {
    remake_board_preview_.as(null);
  }

  async function pick_remake_board_generated() {
    const board = remake_board_preview_.value;
    if (!board) return null;
    const source = String(remake_source_.value || "").trim();
    const shot_id = String(board.shotId || "").trim();
    const generated = String(board.path || "").trim();
    if (!source || !shot_id || !generated) return null;
    try {
      const response = await fetch(
        `${task_console_origin()}/api/video-remake/storyboard-pick`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: source,
            shot_id,
            generated,
          }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload || payload.ok === false) {
        remake_shot_message_.as(
          (payload && payload.error) || "选用结果图失败",
        );
        return payload;
      }
      mark_result_ref_selected(shot_id, generated);
      if (Array.isArray(payload.frames)) {
        show_remake_shots(payload.frames, remake_shot_id_.value);
      }
      remake_shot_message_.as(
        (payload && payload.message) ||
          `已选用第 ${shot_id} 镜结果图，并默认勾选为视频参考。`,
      );
      close_remake_board();
      return payload;
    } catch (_error) {
      remake_shot_message_.as("任务服务没有在运行。选用结果图需要本机任务页保持启动。");
      return null;
    }
  }

  function save_remake_board() {
    const board = remake_board_preview_.value;
    if (!board) return false;
    const path = String(board.path || "").trim();
    let href = "";
    if (path) {
      href = task_file_href(path, true);
    } else {
      const url = String(board.url || "").trim();
      if (!url) return false;
      try {
        const parsed = new URL(url, window.location.origin);
        parsed.searchParams.set("download", "1");
        href = parsed.toString();
      } catch (_error) {
        href = url.includes("download=1")
          ? url
          : `${url}${url.includes("?") ? "&" : "?"}download=1`;
      }
    }
    const file_name = path.split(/[/\\]/).filter(Boolean).pop() || "";
    const link = document.createElement("a");
    link.href = href;
    link.download = file_name;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    return true;
  }

  async function refresh_remake_shots(path) {
    const source = String(path || "").trim();
    const sequence = ++remake_shots_sequence;
    remake_shot_id_.as("");
    if (!source) {
      show_remake_shots([], "");
      remake_shot_message_.as(
        "拉片后关键帧会留在这里；点关键帧可勾选作生图参考，也可上方上传替换图。",
      );
      return;
    }
    if (!(remake_shot_frames || []).length) {
      remake_shot_message_.as(
        "拉片后关键帧会留在这里；点关键帧可勾选作生图参考，也可上方上传替换图。",
      );
    }
    try {
      const response = await fetch(
        `${task_console_origin()}/api/video-remake/shots?path=${encodeURIComponent(source)}`,
      );
      const payload = await response.json().catch(() => ({}));
      if (sequence !== remake_shots_sequence) return;
      if (!response.ok || !payload || payload.ok === false) return;
      if (String(remake_source_.value || "") !== source) return;
      show_remake_shots(payload.frames || [], "");
      sync_remake_story_script_text();
      if (typeof payload.script === "string" && payload.script.trim()) {
        remake_story_script_.as(payload.script);
      }
      if (payload.message && is_pull_shot_message(payload.message)) {
        remake_shot_message_.as(payload.message);
      } else if ((payload.frames || []).length) {
        remake_shot_message_.as("点关键帧可勾选作参考；也可上方上传。生成分镜图时合并已选参考图。");
      }
      await resume_remake_story_jobs(source, sequence);
    } catch (_error) {
      if (sequence !== remake_shots_sequence) return;
      remake_shot_message_.as("拉片记录暂时读不出来。");
    }
  }

  function cut_result_items(paths, label) {
    const stamp = Date.now();
    const title = String(label || "复刻视频").trim() || "复刻视频";
    const unique = [];
    (Array.isArray(paths) ? paths : []).forEach((entry) => {
      const path = String(entry || "").trim();
      if (path && !unique.includes(path)) unique.push(path);
    });
    return unique.map((path) => ({
      path,
      url: `${task_file_href(path, false)}&t=${stamp}`,
      caption: title,
    }));
  }

  function show_remake_cuts(clips) {
    const stamp = Date.now();
    const previous = new Map(
      (Array.isArray(remake_cuts_.value) ? remake_cuts_.value : []).map((clip) => [
        clip.id,
        clip,
      ]),
    );
    remake_cuts_.as(
      (Array.isArray(clips) ? clips : []).map((clip) => {
        const picture = String((clip && clip.path) || "").trim();
        const id = String((clip && (clip.id || clip.file)) || "");
        const old = previous.get(id);
        const label = String((clip && (clip.label || clip.file)) || "");
        const listed = Array.isArray(clip && clip.results) ? clip.results : [];
        const remembered = Array.isArray(old && old.resultItems)
          ? old.resultItems.map((item) => item && item.path)
          : [];
        const resultItems = cut_result_items(listed.length ? listed : remembered, label);
        return {
          id,
          path: picture,
          label,
          url: picture ? `${task_file_href(picture, false)}&t=${stamp}` : "",
          prompt: (old && old.prompt) || "",
          promptUser: Boolean(old && old.promptUser),
          status: (old && old.status) || String((clip && clip.job_message) || ""),
          resultUrl: resultItems.length
            ? resultItems[0].url
            : (old && old.resultUrl) || "",
          resultItems,
          whitePath: String((clip && clip.white) || "").trim(),
          whiteUrl: String((clip && clip.white) || "").trim()
            ? `${task_file_href(String(clip.white), false)}&t=${stamp}`
            : "",
          whiteSelected: String((clip && clip.white) || "").trim()
            ? !(old && old.whiteSelected === false)
            : false,
          rowKey: id,
        };
      }),
    );
  }

  function patch_remake_cut(id, patch) {
    const clips = Array.isArray(remake_cuts_.value) ? remake_cuts_.value : [];
    remake_cuts_.as(
      clips.map((clip) => {
        if (clip.id !== id) return clip;
        return { ...clip, ...patch };
      }),
    );
  }

  function current_remake_cut(id) {
    const clips = Array.isArray(remake_cuts_.value) ? remake_cuts_.value : [];
    return clips.find((clip) => clip.id === id) || null;
  }

  async function refresh_remake_cuts(path) {
    const source = String(path || "").trim();
    if (!source) {
      show_remake_cuts([]);
      remake_cut_message_.as("按 5 秒、10 秒或 15 秒切开后，每一段可以预览。");
      return;
    }
    try {
      const response = await fetch(
        `${task_console_origin()}/api/video-remake/cuts?path=${encodeURIComponent(source)}`,
      );
      const payload = await response.json().catch(() => ({}));
      if (String(remake_source_.value || "") !== source) return;
      if (!response.ok || !payload || payload.ok === false) return;
      show_remake_cuts(payload.clips || []);
      (payload.clips || []).forEach((clip) => {
        if (clip && clip.job_status === "running" && clip.path) {
          watch_cut_job({ id: String(clip.id || ""), path: String(clip.path) });
        }
      });
      if ((payload.clips || []).length) {
        remake_cut_message_.as(`已有 ${payload.clips.length} 段，可以直接预览。`);
      }
    } catch (_error) {
      /* 打开页面时读不到旧切片不影响继续切割 */
    }
  }

  function open_cut_white_model(clip) {
    const path = String((clip && clip.path) || "").trim();
    if (!path) return null;
    const id = `cut:${path}`;
    const title = String((clip && clip.label) || "片段").trim() || "片段";
    stop_white_model_poll();
    const same = String(white_model_source_.value || "") === path;
    white_model_task_id_.as(id);
    white_model_title_.as(`转白模 · ${title}`);
    white_model_source_.as(path);
    if (!same) {
      white_model_url_.as("");
      white_model_path_.as("");
      white_model_progress_.as(-1);
      white_model_error_.as("");
      white_model_contrast_.as(50);
      white_model_relief_.as(30);
      white_model_detail_.as(640);
      white_model_message_.as("点击「转白模」开始。");
      ui.btn_white_model_download$.disable();
    }
    white_model_apply_settings = true;
    ui.btn_white_model_run$.enable();
    ui.whiteModelDialog$.show();
    const sequence = ++white_model_sequence;
    refresh_white_model(sequence, id).then((payload) => {
      if (payload && payload.status === "running") watch_white_model(id);
      if (payload && payload.status === "ready" && payload.path) {
        show_cut_white(path, payload.path);
      }
    });
    watch_cut_white(clip);
    return true;
  }

  const cut_white_polls = {};

  function show_cut_white(path, whitePath) {
    const source = String(path || "").trim();
    const white = String(whitePath || "").trim();
    if (!source || !white) return;
    const clip = (remake_cuts_.value || []).find((item) => item.path === source);
    if (!clip) return;
    patch_remake_cut(clip.id, {
      whitePath: white,
      whiteUrl: `${task_file_href(white, false)}&t=${Date.now()}`,
      whiteSelected: clip.whiteSelected === false ? false : true,
    });
  }

  function watch_cut_white(clip) {
    const id = String((clip && clip.id) || "");
    const path = String((clip && clip.path) || "").trim();
    if (!id || !path) return;
    if (cut_white_polls[id]) clearInterval(cut_white_polls[id]);
    const tick = async () => {
      try {
        const response = await fetch(
          `${task_console_origin()}/api/white-model?path=${encodeURIComponent(path)}`,
        );
        const payload = await response.json().catch(() => ({}));
        if (payload && payload.status === "ready" && payload.path) {
          show_cut_white(path, payload.path);
          clearInterval(cut_white_polls[id]);
          delete cut_white_polls[id];
          return;
        }
        if (payload && (payload.status === "error" || payload.ok === false)) {
          clearInterval(cut_white_polls[id]);
          delete cut_white_polls[id];
        }
      } catch (_error) {
        /* 白模还在转时读不到状态，下一轮再看 */
      }
    };
    cut_white_polls[id] = setInterval(tick, 2000);
  }

  function toggle_cut_white(id) {
    const current = current_remake_cut(id);
    if (!current || !current.whiteUrl) return null;
    patch_remake_cut(id, { whiteSelected: current.whiteSelected === false });
    return true;
  }

  function open_cut_results(id) {
    const current = current_remake_cut(id);
    if (!current) return false;
    const items =
      Array.isArray(current.resultItems) && current.resultItems.length
        ? current.resultItems
        : current.resultUrl
          ? [
              {
                url: current.resultUrl,
                path: "",
                caption: current.label ? `${current.label} 复刻` : "复刻视频",
              },
            ]
          : [];
    if (!items.length) return false;
    open_remake_board({
      kind: "video",
      items,
      selectedPath: String((items[0] && items[0].path) || "").trim(),
      caption: current.label ? `${current.label} 复刻` : "复刻视频",
    });
    return true;
  }

  function open_cut_reverse(clip) {
    const path = String((clip && clip.path) || "").trim();
    if (!path) return null;
    const id = `cut:${path}`;
    const title = String((clip && clip.label) || "片段").trim() || "片段";
    stop_reverse_poll();
    reverse_task_id_.as(id);
    reverse_title_.as(`视频反推 · ${title}`);
    reverse_text_.as("");
    reverse_action_label_.as("开始反推");
    reverse_message_.as("点击「开始反推」开始拆解这一段。");
    ui.btn_reverse_copy$.disable();
    ui.btn_reverse_open$.disable();
    ui.btn_reverse_rerun$.disable();
    ui.reverseDialog$.show();
    return preview_reverse(id, path);
  }

  const remake_cut_polls = {};

  function watch_cut_job(clip) {
    const id = String((clip && clip.id) || "");
    const path = String((clip && clip.path) || "").trim();
    const source = String(remake_source_.value || "").trim();
    if (!id || !path || !source) return;
    if (remake_cut_polls[id]) clearTimeout(remake_cut_polls[id]);
    const tick = async () => {
      try {
        const response = await fetch(
          `${task_console_origin()}/api/video-remake/cut-job?path=${encodeURIComponent(source)}&clip=${encodeURIComponent(path)}`,
        );
        const payload = await response.json().catch(() => ({}));
        if (String(remake_source_.value || "") !== source) return;
        if (!response.ok || !payload || payload.ok === false) {
          patch_remake_cut(id, { status: (payload && payload.error) || "片段任务读不到" });
          return;
        }
        const current = current_remake_cut(id);
        const patch = { status: payload.message || payload.error || "" };
        const incoming = String(payload.prompt || "");
        const own = String((current && current.prompt) || "");
        if (current && current.promptUser && own.trim() && incoming && incoming !== own) {
          if (payload.status !== "running") patch.status = "已保留你填写的提示词。";
        } else if (incoming && incoming !== own && payload.status !== "running") {
          patch.prompt = incoming;
          patch.promptUser = false;
          fill_cut_prompt_box(id, incoming);
        }
        const outputs = Array.isArray(payload.outputs)
          ? payload.outputs.map((item) => String(item || "").trim()).filter(Boolean)
          : [];
        const newest = String(payload.output || "").trim();
        if (newest && !outputs.includes(newest)) outputs.unshift(newest);
        if (outputs.length) {
          const items = cut_result_items(outputs, (current && current.label) || "");
          patch.resultItems = items;
          patch.resultUrl = items[0] ? items[0].url : "";
        }
        patch_remake_cut(id, patch);
        if (payload.status === "running") {
          remake_cut_polls[id] = setTimeout(tick, 2000);
        }
      } catch (_error) {
        patch_remake_cut(id, { status: "任务服务没有在运行。" });
      }
    };
    remake_cut_polls[id] = setTimeout(tick, 800);
  }

  async function preview_cut_prompt(clip) {
    const source = String(remake_source_.value || "").trim();
    const path = String((clip && clip.path) || "").trim();
    const id = String((clip && clip.id) || "");
    if (!source || !path || !id) return null;
    const current = current_remake_cut(id);
    if (current && current.promptUser && String(current.prompt || "").trim()) {
      patch_remake_cut(id, { status: "已使用你填写的提示词。" });
      return { ok: true, prompt: current.prompt, kept: true };
    }
    patch_remake_cut(id, { status: "正在写复刻提示词…", promptUser: false, prompt: "" });
    fill_cut_prompt_box(id, "");
    try {
      const response = await fetch(`${task_console_origin()}/api/video-remake/cut-prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: source,
          clip: path,
          prompt_llm: selected_prompt_llm(),
          note: String(remake_note_.value || "").trim(),
          use_white: Boolean(current && current.whiteUrl) && current.whiteSelected !== false,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload || payload.ok === false) {
        patch_remake_cut(id, { status: (payload && payload.error) || "写复刻提示词失败" });
        return payload;
      }
      watch_cut_job(clip);
      return payload;
    } catch (_error) {
      patch_remake_cut(id, { status: "任务服务没有在运行。提示词生成需要本机任务页保持启动。" });
      return null;
    }
  }

  async function run_cut_remake(clip) {
    const source = String(remake_source_.value || "").trim();
    const path = String((clip && clip.path) || "").trim();
    const id = String((clip && clip.id) || "");
    if (!source || !path || !id) return null;
    const current = current_remake_cut(id);
    const prompt = String((current && current.prompt) || "").trim();
    if (!prompt) {
      patch_remake_cut(id, { status: "先填写或生成提示词。" });
      return null;
    }
    const model = normalize_remake_reference().model || "mu-video";
    patch_remake_cut(id, { status: "正在准备片段复刻…" });
    try {
      const response = await fetch(`${task_console_origin()}/api/video-remake/cut-remake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: source,
          clip: path,
          prompt,
          model,
          use_white: Boolean(current.whiteUrl) && current.whiteSelected !== false,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload || payload.ok === false) {
        patch_remake_cut(id, { status: (payload && payload.error) || "片段复刻失败" });
        return payload;
      }
      watch_cut_job(clip);
      return payload;
    } catch (_error) {
      patch_remake_cut(id, { status: "任务服务没有在运行。片段复刻需要本机任务页保持启动。" });
      return null;
    }
  }

  function fill_cut_prompt_box(id, text) {
    const area = document.querySelector(`[data-cut-prompt="${CSS.escape(String(id))}"]`);
    if (!area || document.activeElement === area || area.value === text) return;
    area.value = text;
  }

  function update_cut_prompt(id, text) {
    const value = String(text || "");
    patch_remake_cut(id, { prompt: value, promptUser: Boolean(value.trim()) });
  }

  async function run_remake_cut() {
    const source = String(remake_source_.value || "").trim();
    if (remake_shot_busy_.value || remake_cut_busy_.value) return null;
    if (!source) {
      remake_cut_message_.as("缺少视频路径，无法切割。请从下载列表重新打开视频复刻。");
      return null;
    }
    const raw_step = Number(remake_cut_step_.value);
    const step = raw_step === 15 || raw_step === 10 ? raw_step : 5;
    remake_cut_busy_.as(true);
    remake_shot_phase_.as("cut");
    remake_cut_message_.as(`正在按 ${step} 秒切割…`);
    try {
      const response = await fetch(`${task_console_origin()}/api/video-remake/cut`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: source, step }),
      });
      const payload = await response.json().catch(() => ({}));
      if (String(remake_source_.value || "") !== source) return payload;
      if (!response.ok || !payload || payload.ok === false) {
        remake_cut_message_.as((payload && payload.error) || "视频切割失败");
        return payload;
      }
      show_remake_cuts(payload.clips || []);
      remake_cut_message_.as(
        payload.message || `已按 ${step} 秒切成 ${payload.count || 0} 段。`,
      );
      return payload;
    } catch (_error) {
      remake_cut_message_.as("任务服务没有在运行。视频切割需要本机任务页保持启动。");
      return null;
    } finally {
      remake_cut_busy_.as(false);
      remake_shot_phase_.as("");
    }
  }

  async function run_remake_shots() {
    const source = String(remake_source_.value || "").trim();
    if (remake_shot_busy_.value || remake_cut_busy_.value) return null;
    if (!source) {
      remake_shot_message_.as(
        "缺少视频路径，无法拉片。请从下载列表重新打开视频复刻。",
      );
      remake_message_.as("缺少视频路径，无法拉片。");
      return null;
    }
    const mode = remake_shot_mode_.value === "plot" ? "plot" : "scene";
    const sequence = ++remake_shots_sequence;
    remake_shot_phase_.as("shots");
    remake_shot_busy_.as(true);
    sync_remake_run_button();
    remake_shot_message_.as(mode === "plot" ? "正在按情节拉片…" : "正在按画面拉片…");
    Object.keys(remake_story_prompts).forEach((key) => {
      delete remake_story_prompts[key];
    });
    Object.keys(remake_story_video_prompts).forEach((key) => {
      delete remake_story_video_prompts[key];
    });
    Object.keys(remake_story_scripts).forEach((key) => {
      delete remake_story_scripts[key];
    });
    remake_story_script_.as("");
    try {
      const response = await fetch(`${task_console_origin()}/api/video-remake/shots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: source, mode }),
      });
      const payload = await response.json().catch(() => ({}));
      if (sequence !== remake_shots_sequence) return payload;
      if (!response.ok || !payload || payload.ok === false) {
        remake_shot_message_.as((payload && payload.error) || "拉片失败");
        return payload;
      }
      if (String(remake_source_.value || "") !== source) return payload;
      remake_shot_id_.as("");
      show_remake_shots(payload.frames || [], "");
      remake_shot_message_.as(
        payload.message || "拉片完成。点关键帧可勾选作参考，也可上方上传；两者可一起用作生图参考。",
      );
      return payload;
    } catch (_error) {
      if (sequence !== remake_shots_sequence) return null;
      remake_shot_message_.as("任务服务没有在运行。拉片需要本机任务页保持启动。");
      return null;
    } finally {
      remake_shot_busy_.as(false);
      remake_shot_phase_.as("");
      sync_remake_run_button();
    }
  }

  function story_job_still_running(payload, shotId, phase) {
    const target = String(shotId || "").trim();
    const jobs = Array.isArray(payload && payload.jobs) ? payload.jobs : [];
    const wanted_mode =
      phase === "story-prompt"
        ? "prompt"
        : phase === "story-script"
          ? "script"
          : phase === "story-video"
            ? "video"
            : phase === "story"
              ? "image"
              : "";
    const mine = jobs.find((job) => {
      if (!job || job.status !== "running") return false;
      const sid = String(job.shot_id || "").trim();
      if (target && sid && sid !== target) return false;
      if (target && !sid) return !wanted_mode || String(job.mode || "") === wanted_mode;
      if (!target && sid) return false;
      if (wanted_mode && String(job.mode || "") && String(job.mode || "") !== wanted_mode) {
        return false;
      }
      return true;
    });
    if (mine) return mine;
    if (
      payload &&
      payload.status === "running" &&
      String(payload.shot_id || "").trim() === target
    ) {
      return {
        mode: payload.mode,
        shot_id: payload.shot_id,
        message: payload.message,
        status: "running",
      };
    }
    return null;
  }

  async function poll_remake_storyboard(source, shotId, phase) {
    const target = String(shotId || "").trim();
    const busy_phase = String(phase || story_busy_phase(target) || "story");
    try {
      const response = await fetch(
        `${task_console_origin()}/api/video-remake/storyboard?path=${encodeURIComponent(source)}`,
      );
      const payload = await response.json().catch(() => ({}));
      if (String(remake_source_.value || "") !== source) return payload;
      apply_storyboard_payload_frames(payload);
      const running = story_job_still_running(payload, target, busy_phase);
      if (running) {
        const running_note = story_running_note(running, target, busy_phase);
        set_story_row_status(String(running.shot_id || target), running_note);
        show_remake_shots(remake_shot_frames, remake_shot_id_.value);
        window.setTimeout(
          () => poll_remake_storyboard(source, target, busy_phase),
          2000,
        );
        return payload;
      }
      clear_story_busy(target, busy_phase);
      sync_remake_run_button();
      const failed = (Array.isArray(payload && payload.jobs) ? payload.jobs : []).find(
        (job) => {
          if (!job || job.status !== "error") return false;
          if (String(job.shot_id || "").trim() !== target) return false;
          const mode = String(job.mode || "");
          if (busy_phase === "story-video") return mode === "video";
          if (busy_phase === "story-script") return mode === "script";
          if (busy_phase === "story-prompt") return mode === "prompt";
          return mode === "image" || !mode;
        },
      );
      if (failed) {
        const err = String(failed.error || failed.message || "生成失败");
        set_story_row_status(target, err);
        remake_shot_message_.as(err);
        show_remake_shots(remake_shot_frames, remake_shot_id_.value);
        return payload;
      }
      const done_mode = String((payload && payload.mode) || "");
      if (busy_phase === "story-script" || done_mode === "script") {
        if (target) set_story_row_status(target, "");
        else {
          remake_shot_frames = (remake_shot_frames || []).map((frame) => ({
            ...frame,
            status: /分镜脚本|写分镜脚本/.test(String(frame.status || ""))
              ? ""
              : frame.status,
          }));
        }
        if (payload && payload.error) remake_shot_message_.as(payload.error);
        else if (payload && payload.message) remake_shot_message_.as(payload.message);
      } else if (payload && payload.error && String(payload.shot_id || "") === target) {
        set_story_row_status(target, payload.error);
      } else {
        const done_note =
          (payload &&
            String(payload.shot_id || "") === target &&
            (payload.message || payload.error)) ||
          (busy_phase === "story-prompt"
            ? "分镜提示词已写好。"
            : busy_phase === "story-video"
              ? `第 ${target} 镜视频已生成。`
              : `第 ${target} 镜分镜图已生成。`);
        if (target) set_story_row_status(target, done_note);
      }
      show_remake_shots(remake_shot_frames, remake_shot_id_.value);
      return payload;
    } catch (_error) {
      clear_story_busy(target, busy_phase);
      sync_remake_run_button();
      remake_shot_message_.as("任务服务没有在运行。生成分镜图需要本机任务页保持启动。");
      return null;
    }
  }

  async function run_remake_story_script(shotId) {
    const source = String(remake_source_.value || "").trim();
    const target = String(shotId || "").trim();
    if (!source || remake_shot_busy_.value) return null;
    if (story_busy_phase(target)) return null;
    if (!(remake_shot_frames || []).length) {
      remake_shot_message_.as("先拉片，再生成分镜脚本。");
      return null;
    }
    set_story_busy(target, "story-script");
    sync_remake_run_button();
    const llm_label = story_prompt_llm_label(selected_prompt_llm());
    const writing_note = target
      ? `正在用 ${llm_label} 写第 ${target} 镜分镜脚本…`
      : `正在用 ${llm_label} 按镜头批量写分镜脚本…`;
    if (target) set_story_row_status(target, writing_note);
    else {
      remake_shot_frames = (remake_shot_frames || []).map((frame) => ({
        ...frame,
        status: writing_note,
      }));
    }
    remake_shot_message_.as(writing_note);
    show_remake_shots(remake_shot_frames, remake_shot_id_.value);
    try {
      const response = await fetch(
        `${task_console_origin()}/api/video-remake/storyboard-script`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: source,
            shot_id: target,
            note: String(remake_note_.value || "").trim(),
            prompt_llm: selected_prompt_llm(),
          }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload || payload.ok === false) {
        clear_story_busy(target, "story-script");
        sync_remake_run_button();
        const err = (payload && payload.error) || "写分镜脚本失败";
        if (target) set_story_row_status(target, err);
        remake_shot_message_.as(err);
        show_remake_shots(remake_shot_frames, remake_shot_id_.value);
        return payload;
      }
      if (typeof payload.script === "string" && payload.script.trim()) {
        remake_story_script_.as(payload.script);
      }
      return poll_remake_storyboard(source, target, "story-script");
    } catch (_error) {
      clear_story_busy(target, "story-script");
      sync_remake_run_button();
      const err = "任务服务没有在运行。写分镜脚本需要本机任务页保持启动。";
      if (target) set_story_row_status(target, err);
      remake_shot_message_.as(err);
      show_remake_shots(remake_shot_frames, remake_shot_id_.value);
      return null;
    }
  }

  async function run_remake_story_prompts(shotId) {
    const source = String(remake_source_.value || "").trim();
    const target = String(shotId || "").trim();
    if (!source || remake_shot_busy_.value) return null;
    if (story_busy_phase(target)) return null;
    if (!(remake_shot_frames || []).length) {
      remake_shot_message_.as("先拉片，再写分镜提示词。");
      return null;
    }
    set_story_busy(target, "story-prompt");
    sync_remake_run_button();
    const llm_label = story_prompt_llm_label(selected_prompt_llm());
    const writing_note = target
      ? `正在用 ${llm_label} 写第 ${target} 镜提示词…`
      : `正在用 ${llm_label} 为每镜写专业提示词…`;
    if (target) set_story_row_status(target, writing_note);
    else {
      remake_shot_frames = (remake_shot_frames || []).map((frame) => ({
        ...frame,
        status: writing_note,
      }));
    }
    show_remake_shots(remake_shot_frames, remake_shot_id_.value);
    try {
      const response = await fetch(
        `${task_console_origin()}/api/video-remake/storyboard-prompts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: source,
            shot_id: target,
            note: String(remake_note_.value || "").trim(),
            prompt_llm: selected_prompt_llm(),
          }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload || payload.ok === false) {
        clear_story_busy(target, "story-prompt");
        sync_remake_run_button();
        set_story_row_status(target || "", (payload && payload.error) || "写分镜提示词失败");
        show_remake_shots(remake_shot_frames, remake_shot_id_.value);
        return payload;
      }
      if (payload && Array.isArray(payload.frames)) {
        show_remake_shots(payload.frames, remake_shot_id_.value);
      }
      return poll_remake_storyboard(source, target, "story-prompt");
    } catch (_error) {
      clear_story_busy(target, "story-prompt");
      sync_remake_run_button();
      set_story_row_status(target || "", "任务服务没有在运行。写提示词需要本机任务页保持启动。");
      show_remake_shots(remake_shot_frames, remake_shot_id_.value);
      return null;
    }
  }

  async function run_remake_storyboard(shotId) {
    const source = String(remake_source_.value || "").trim();
    const target = String(shotId || "").trim();
    if (!source || !target || remake_shot_busy_.value) return null;
    if (story_busy_phase(target)) return null;
    set_story_busy(target, "story");
    sync_remake_run_button();
    const draft = String(remake_story_prompts[target] || "").trim();
    const picked = String(remake_story_model_.value || "").trim();
    const image_model =
      picked === "seedream"
        ? "seedream"
        : picked === "mj-img" || picked === "mj"
          ? "mj-img"
          : picked === "mu-image" || picked === "muse-image"
            ? "mu-image"
            : "gt-image";
    set_story_row_status(
      target,
      is_weak_story_prompt(draft)
        ? `正在用 ${story_prompt_llm_label(selected_prompt_llm())} 写第 ${target} 镜专业提示词，再生成…`
        : `正在用 ${story_image_label(image_model)} 生成第 ${target} 镜…`,
    );
    show_remake_shots(remake_shot_frames, remake_shot_id_.value);
    try {
      const response = await fetch(`${task_console_origin()}/api/video-remake/storyboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: source,
          shot_id: target,
          prompt: draft,
          note: String(remake_note_.value || "").trim(),
          image_model,
          prompt_llm: selected_prompt_llm(),
          reference_ids: selected_story_ref_ids(),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload || payload.ok === false) {
        clear_story_busy(target, "story");
        sync_remake_run_button();
        set_story_row_status(target, (payload && payload.error) || "生成分镜图失败");
        show_remake_shots(remake_shot_frames, remake_shot_id_.value);
        return payload;
      }
      if (payload && Array.isArray(payload.frames)) {
        show_remake_shots(payload.frames, remake_shot_id_.value);
      }
      return poll_remake_storyboard(source, target, "story");
    } catch (_error) {
      clear_story_busy(target, "story");
      sync_remake_run_button();
      set_story_row_status(target, "任务服务没有在运行。生成分镜图需要本机任务页保持启动。");
      show_remake_shots(remake_shot_frames, remake_shot_id_.value);
      return null;
    }
  }

  async function run_remake_story_video(shotId) {
    const source = String(remake_source_.value || "").trim();
    const target = String(shotId || "").trim();
    if (!source || !target || remake_shot_busy_.value) return null;
    if (story_busy_phase(target)) return null;
    const frame = (remake_shot_frames || []).find(
      (item) => String(item.id || "") === target,
    );
    const draft = String(
      remake_story_scripts[target] || (frame && frame.script) || "",
    ).trim();
    if (!draft) {
      remake_shot_message_.as("先生成分镜脚本。");
      return null;
    }
    const video_refs = selected_video_ref_ids(target);
    if (!video_refs.length) {
      remake_shot_message_.as("先勾选这一镜的结果图，或上传替换图后再生成视频。");
      return null;
    }
    const selected = remake_reference_.value || {};
    const video_model = String(selected.model || "mu-video");
    set_story_busy(target, "story-video");
    sync_remake_run_button();
    set_story_row_status(target, `正在生成第 ${target} 镜视频…`);
    show_remake_shots(remake_shot_frames, remake_shot_id_.value);
    try {
      const response = await fetch(
        `${task_console_origin()}/api/video-remake/storyboard-video`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: source,
            shot_id: target,
            prompt: draft,
            note: String(remake_note_.value || "").trim(),
            video_model,
            reference_ids: video_refs,
          }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload || payload.ok === false) {
        clear_story_busy(target, "story-video");
        sync_remake_run_button();
        set_story_row_status(target, (payload && payload.error) || "生成分镜视频失败");
        show_remake_shots(remake_shot_frames, remake_shot_id_.value);
        return payload;
      }
      if (payload && Array.isArray(payload.frames)) {
        show_remake_shots(payload.frames, remake_shot_id_.value);
      }
      return poll_remake_storyboard(source, target, "story-video");
    } catch (_error) {
      clear_story_busy(target, "story-video");
      sync_remake_run_button();
      set_story_row_status(target, "任务服务没有在运行。生成分镜视频需要本机任务页保持启动。");
      show_remake_shots(remake_shot_frames, remake_shot_id_.value);
      return null;
    }
  }

  function pick_remake_shot(shot) {
    const id = String((shot && shot.id) || "").trim();
    if (!id) return false;
    remake_shot_id_.as(id);
    show_remake_shots(remake_shot_frames, id);
    return true;
  }

  function media_work_page_href(pathname, options = {}) {
    const page = new URL(window.location.href);
    page.pathname = pathname;
    page.search = "";
    page.hash = "";
    const id = String(options.id || "").trim();
    const path = String(options.path || "").trim();
    const title = String(options.title || "").trim();
    if (id) page.searchParams.set("id", id);
    if (path) page.searchParams.set("path", path);
    if (title) page.searchParams.set("title", title);
    return page.toString();
  }

  function remake_page_href(options = {}) {
    return media_work_page_href("/remake", options);
  }

  function analyze_page_href(options = {}) {
    return media_work_page_href("/analyze", options);
  }

  function seed_auth_for_new_tab() {
    const key = "vf-auth-user";
    try {
      let user = sessionStorage.getItem(key) || localStorage.getItem(key);
      if (!user && window.top && window.top !== window) {
        try {
          user =
            window.top.sessionStorage.getItem(key) ||
            window.top.localStorage.getItem(key);
        } catch (_error) {
          /* ignore cross-frame access */
        }
      }
      if (user) {
        localStorage.setItem(key, user);
        sessionStorage.setItem(key, user);
      }
    } catch (_error) {
      /* ignore storage access */
    }
  }

  function open_work_window(href) {
    seed_auth_for_new_tab();
    // 不用 noopener：新标签要继承登录态，否则 index.html 会踢到 /login
    window.open(href, "_blank");
    return href;
  }

  function open_remake_window(options = {}) {
    return open_work_window(remake_page_href(options));
  }

  function open_analyze_window(options = {}) {
    return open_work_window(analyze_page_href(options));
  }

  function boot_remake_session(options = {}) {
    const id = String(options.id || "").trim();
    if (!id) return null;
    stop_remake_poll();
    const page_label =
      String(options.pageLabel || "").trim() || "视频复刻";
    const title =
      String(options.title || "").trim() || page_label;
    const media_path = String(options.path || "").trim();
    const status = String(options.status || "done").trim();
    const same = remake_task_id_.value === id;
    remake_task_id_.as(id);
    remake_source_.as(media_path);
    remake_page_label_.as(page_label);
    remake_title_.as(title);
    if (typeof document !== "undefined") {
      document.title =
        title && title !== page_label ? `${page_label} · ${title}` : page_label;
    }
    if (!same) {
      remake_fill_from_reverse = false;
      remake_reverse_label_.as("视频反推");
      remake_image_file = null;
      remake_image_name_.as("可以不选参考图");
      remake_shot_mode_.as("scene");
      remake_cut_step_.as(5);
      remake_cuts_.as([]);
      remake_cut_message_.as("按 5 秒、10 秒或 15 秒切开后，每一段可以预览。");
      remake_shot_busy_.as(false);
      remake_shot_phase_.as("");
      remake_story_busy_map_.as({});
      clear_remake_story_frame_refs();
      Object.keys(remake_story_prompts).forEach((key) => {
        delete remake_story_prompts[key];
      });
      Object.keys(remake_story_video_prompts).forEach((key) => {
        delete remake_story_video_prompts[key];
      });
      Object.keys(remake_story_scripts).forEach((key) => {
        delete remake_story_scripts[key];
      });
      remake_story_script_.as("");
      remake_reference_.as({ source: true, white: true, whiteReady: false, model: "mu-video" });
      remake_url_.as("");
      remake_path_.as("");
      remake_error_.as("");
      remake_progress_.as(-1);
      remake_prompt_.as("");
      remake_note_.as("");
      ui.input_remake_note$.setValue("", { silence: true });
    }
    const show_cuts = options.showCuts !== false;
    const show_reverse = options.showReverse !== false;
    const show_storyboard = options.showStoryboard !== false;
    const ready = normalize_download_status(status) === "done" && Boolean(media_path);
    if (normalize_download_status(status) !== "done") {
      remake_message_.as("请等这条任务下载完成后再复刻。");
    } else if (!media_path) {
      remake_message_.as("这条任务没有可复刻的本地视频。");
    } else {
      remake_message_.as(remake_idle_message());
    }
    sync_remake_run_button();
    if (!ready) {
      ui.btn_remake_prompt$.disable();
      ui.btn_remake_run$.disable();
      ui.btn_remake_reverse_report$.disable();
    } else if (show_reverse) {
      refresh_remake_reverse_report(media_path);
    } else {
      ui.btn_remake_prompt$.disable();
      ui.btn_remake_reverse_report$.disable();
    }
    ui.btn_remake_download$.disable();
    refresh_remake_white(media_path);
    if (show_storyboard) {
      refresh_remake_shots(media_path);
    } else {
      remake_shots_.as([]);
      remake_shot_frames = [];
      remake_shot_message_.as("");
    }
    if (!show_cuts) {
      remake_cuts_.as([]);
      remake_cut_message_.as("");
    } else {
      refresh_remake_cuts(media_path);
    }
    refresh_remake_story_refs(media_path);
    if (!ready) return true;
    const sequence = ++remake_sequence;
    refresh_remake(sequence, id).then((payload) => {
      if (payload && payload.status === "running") watch_remake(id);
    });
    return true;
  }

  function open_named_work(task, opener, fallback) {
    const raw = task_snapshot(task);
    const id = String(raw.id || "").trim();
    if (!id) return null;
    const title = String(raw.name || raw.title || fallback).trim() || fallback;
    const media_path = task_media_path(raw);
    opener({ id, path: media_path, title });
    return true;
  }

  function open_remake(task) {
    return open_named_work(task, open_remake_window, "视频复刻");
  }

  function open_analyze(task) {
    return open_named_work(task, open_analyze_window, "视频重绘");
  }

  function boot_remake_from_query(query = {}) {
    const id = String(query.id || "").trim();
    const path = String(query.path || "").trim();
    const page_label = String(query.pageLabel || "").trim();
    const show_cuts = query.showCuts !== false;
    const show_reverse = query.showReverse !== false;
    const show_storyboard = query.showStoryboard !== false;
    const title =
      String(query.title || page_label || "视频复刻").trim() || "视频复刻";
    if (!id && !path) {
      remake_page_label_.as(page_label || "视频复刻");
      remake_title_.as(page_label || "视频复刻");
      if (typeof document !== "undefined") {
        document.title = page_label || "视频复刻";
      }
      remake_message_.as(
        page_label
          ? `缺少任务信息，请从下载列表重新打开${page_label}。`
          : "缺少任务信息，请从下载列表重新打开视频复刻。",
      );
      return null;
    }
    if (path) {
      return boot_remake_session({
        id: id || path,
        path,
        title,
        status: "done",
        pageLabel: page_label,
        showCuts: show_cuts,
        showReverse: show_reverse,
        showStoryboard: show_storyboard,
      });
    }
    const task$ = domain_task(id);
    const raw = task_snapshot(task$);
    if (!raw || !Object.keys(raw).length) {
      remake_task_id_.as(id);
      remake_page_label_.as(page_label || "视频复刻");
      remake_title_.as(title);
      remake_message_.as("正在读取任务…");
      return ready().then(() => {
        const loaded = domain_task(id);
        const snapshot = task_snapshot(loaded);
        if (!snapshot || !Object.keys(snapshot).length) {
          remake_message_.as("找不到这条下载任务。");
          return null;
        }
        return boot_remake_session({
          id,
          path: task_media_path(snapshot),
          title: String(snapshot.name || snapshot.title || title).trim() || title,
          status: snapshot.status,
          pageLabel: page_label,
          showCuts: show_cuts,
          showReverse: show_reverse,
          showStoryboard: show_storyboard,
        });
      });
    }
    return boot_remake_session({
      id,
      path: task_media_path(raw),
      title: String(raw.name || raw.title || title).trim() || title,
      status: raw.status,
      pageLabel: page_label,
      showCuts: show_cuts,
      showReverse: show_reverse,
      showStoryboard: show_storyboard,
    });
  }

  async function fill_remake_from_reverse() {
    const source = String(remake_source_.value || "").trim();
    if (!source) return null;
    remake_shot_busy_.as(true);
    remake_shot_phase_.as("reverse");
    remake_reverse_label_.as("反推中");
    sync_remake_run_button();
    try {
      const response = await fetch(
        `${task_console_origin()}/api/video-remake/from-reverse`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: source }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload || payload.ok === false) {
        remake_shot_message_.as((payload && payload.error) || "按反推拆分镜头失败");
        remake_message_.as((payload && payload.error) || "按反推拆分镜头失败");
        return payload;
      }
      Object.keys(remake_story_prompts).forEach((key) => {
        delete remake_story_prompts[key];
      });
      Object.keys(remake_story_video_prompts).forEach((key) => {
        delete remake_story_video_prompts[key];
      });
      Object.keys(remake_story_scripts).forEach((key) => {
        delete remake_story_scripts[key];
      });
      remake_story_script_.as("");
      remake_shot_id_.as("");
      show_remake_shots(payload.frames || [], "");
      remake_shot_message_.as("点关键帧可勾选作参考；也可上方上传。生成分镜图时合并已选参考图。");
      remake_message_.as(remake_idle_message());
      ui.btn_remake_reverse_report$.enable();
      return payload;
    } catch (_error) {
      remake_shot_message_.as("任务服务没有在运行。按反推拆分镜头需要本机任务页保持启动。");
      remake_message_.as("任务服务没有在运行。按反推拆分镜头需要本机任务页保持启动。");
      return null;
    } finally {
      remake_shot_busy_.as(false);
      remake_shot_phase_.as("");
      remake_reverse_label_.as("视频反推");
      sync_remake_run_button();
    }
  }

  async function run_remake_reverse() {
    const id = String(remake_task_id_.value || "").trim();
    const source = String(remake_source_.value || "").trim();
    if (!id || !source || remake_shot_busy_.value) return null;
    remake_fill_from_reverse = true;
    remake_reverse_label_.as("反推中");
    remake_shot_busy_.as(true);
    remake_shot_phase_.as("reverse");
    remake_error_.as("");
    remake_shot_message_.as("正在拆镜头（不看图写提示词）…");
    remake_message_.as("正在拆镜头（不看图写提示词）…");
    sync_remake_run_button();
    // 复刻反推只拆镜头/声音，不走 VLM 写提示词。
    reverse_vlm_.as(false);
    reverse_vlm_frames_.as("3");
    try {
      const payload = await begin_reverse(id, source, true);
      if (!payload || payload.ok === false || payload.status === "error") {
        remake_fill_from_reverse = false;
        remake_reverse_label_.as("视频反推");
        remake_shot_busy_.as(false);
        remake_shot_phase_.as("");
        remake_shot_message_.as(
          (payload && (payload.error || payload.message)) || "视频反推失败",
        );
        sync_remake_run_button();
      }
      return payload;
    } catch (_error) {
      remake_fill_from_reverse = false;
      remake_reverse_label_.as("视频反推");
      remake_shot_busy_.as(false);
      remake_shot_phase_.as("");
      remake_shot_message_.as("任务服务没有在运行。视频反推需要本机任务页保持启动。");
      remake_message_.as("任务服务没有在运行。视频反推需要本机任务页保持启动。");
      sync_remake_run_button();
      return null;
    }
  }

  async function run_remake() {
    const id = String(remake_task_id_.value || "").trim();
    const source = String(remake_source_.value || "").trim();
    if (!id || !source) return null;
    const flags = remake_request_flags();
    stop_remake_poll();
    const sequence = ++remake_sequence;
    const force = Boolean(remake_url_.value);
    remake_progress_.as(0);
    remake_error_.as("");
    remake_message_.as("正在准备 5 秒预览…");
    set_remake_job(id, "loading");
    ui.btn_remake_run$.disable();
    ui.btn_remake_download$.disable();
    if (force) {
      remake_url_.as("");
      remake_path_.as("");
    }
    const body = new FormData();
    body.append("path", source);
    if (remake_image_file) body.append("image", remake_image_file, remake_image_file.name);
    if (force) body.append("force", "1");
    body.append("model", flags.model);
    body.append("use_original", flags.use_original ? "1" : "0");
    body.append("use_white", flags.use_white ? "1" : "0");
    if (flags.use_white) body.append("reference_path", white_model_output_path(source));
    const note = String(remake_note_.value || "").trim();
    if (note) body.append("note", note.slice(0, 2000));
    try {
      const response = await fetch(`${task_console_origin()}/api/video-remake`, {
        method: "POST",
        body,
      });
      const payload = await response.json().catch(() => ({}));
      apply_remake_status(payload, sequence, id);
      if (payload && payload.status === "running") watch_remake(id);
      return payload;
    } catch (_error) {
      if (sequence !== remake_sequence) return null;
      remake_message_.as("任务服务没有在运行。视频复刻需要本机任务页保持启动。");
      set_remake_job(id, "error");
      sync_remake_run_button();
      return null;
    }
  }

  function download_remake() {
    const path = String(remake_path_.value || "").trim();
    if (!path) return false;
    const link = document.createElement("a");
    link.href = task_file_href(path, true);
    link.download = "";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    return true;
  }

  function white_model_output_path(source) {
    const path = String(source || "");
    const slash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
    const name = slash >= 0 ? path.slice(slash + 1) : path;
    const dot = name.lastIndexOf(".");
    const stem = dot > 0 ? name.slice(0, dot) : name;
    return `${slash >= 0 ? path.slice(0, slash + 1) : ""}${stem}.whitemodel.mp4`;
  }

  async function start_all_tasks() {
    try {
      return await downloader.startAll({ status: active_status_.value });
    } catch (error) {
      report_error(error, "开始全部下载任务失败");
      return null;
    }
  }

  async function pause_all_tasks() {
    try {
      return await downloader.pauseAll({ status: active_status_.value });
    } catch (error) {
      report_error(error, "暂停全部下载任务失败");
      return null;
    }
  }

  function visible_records() {
    return tasks_.value || [];
  }

  function visible_task_ids() {
    return visible_records().map(task_identifier).filter((id) => id !== undefined);
  }

  function request_delete_task(task) {
    if (!domain_task(task)) {
      report_error(null, "下载任务不存在");
      return;
    }
    delete_task_.as(task);
    delete_task_ids_.as([]);
    delete_delete_files_.as(true);
    ui.deleteConfirmDialog$.show();
  }

  function request_delete_selected_tasks() {
    const ids = selected_task_ids_.value || [];
    if (!ids.length) {
      DLUtils.warning({ msg: "请选择要删除的下载任务" });
      return;
    }
    delete_task_.as(null);
    delete_task_ids_.as([...ids]);
    delete_delete_files_.as(true);
    ui.deleteConfirmDialog$.show();
  }

  async function confirm_delete_task() {
    if (deleting_task_.value) return;
    const direct_task = delete_task_.value;
    const ids = delete_task_ids_.value || [];
    const targets = direct_task
      ? [domain_task(direct_task)]
      : ids.map((id) => downloader.get(id));
    const tasks = targets.filter(Boolean);
    if (!tasks.length) {
      ui.deleteConfirmDialog$.hide();
      return;
    }
    deleting_task_.as(true);
    const errors = [];
    try {
      for (const task$ of tasks) {
        try {
          await task$.methods.delete({
            deleteFiles: delete_delete_files_.value,
          });
        } catch (error) {
          errors.push(error);
        }
      }
      if (!errors.length) {
        delete_task_.as(null);
        delete_task_ids_.as([]);
        selected_task_ids_.as([]);
        ui.deleteConfirmDialog$.hide();
      } else {
        report_error(errors[0], "删除下载任务失败");
      }
    } finally {
      deleting_task_.as(false);
      await load_page(page_.value);
    }
  }

  function request_clear_tasks(delete_files = false) {
    delete_delete_files_.as(Boolean(delete_files));
    ui.clearConfirmDialog$.show();
  }

  async function confirm_clear_tasks() {
    if (clearing_tasks_.value) return;
    clearing_tasks_.as(true);
    try {
      await downloader.clear({ deleteFiles: delete_delete_files_.value });
      selected_task_ids_.as([]);
      ui.clearConfirmDialog$.hide();
      await load_page(1);
    } catch (error) {
      report_error(error, "清空下载任务失败");
    } finally {
      clearing_tasks_.as(false);
    }
  }

  function set_loaded_tasks_selected(selected) {
    const ids = visible_task_ids();
    if (selected) {
      const selected_ids = [...(selected_task_ids_.value || [])];
      ids.forEach((id) => {
        if (!selected_ids.some((selected_id) => selected_id === id)) {
          selected_ids.push(id);
        }
      });
      selected_task_ids_.as(selected_ids);
      selection_anchor_task_id = ids.length ? ids[ids.length - 1] : null;
      return;
    }
    const visible_ids = new Set(ids);
    selected_task_ids_.as(
      (selected_task_ids_.value || []).filter((id) => !visible_ids.has(id)),
    );
    selection_anchor_task_id = null;
  }

  function toggle_loaded_tasks_selected() {
    set_loaded_tasks_selected(!loaded_task_selection_.value.checked);
  }

  function task_selection_state(task) {
    const task_id = task_identifier(task);
    return computed(selected_task_ids_, (ids) => ({
      checked: (ids || []).some((selected_id) => selected_id === task_id),
      indeterminate: false,
    }));
  }

  function toggle_task_selected(task, options = {}) {
    const id = task_identifier(task);
    if (id === undefined || id === null || id === "") return;
    let ids = [...(selected_task_ids_.value || [])];
    if (options.shiftKey && selection_anchor_task_id !== null) {
      const visible_ids = visible_task_ids();
      const from = visible_ids.findIndex((value) => value === selection_anchor_task_id);
      const to = visible_ids.findIndex((value) => value === id);
      if (from >= 0 && to >= 0) {
        const start = Math.min(from, to);
        const end = Math.max(from, to);
        visible_ids.slice(start, end + 1).forEach((range_id) => {
          if (!ids.some((selected_id) => selected_id === range_id)) ids.push(range_id);
        });
        selected_task_ids_.as(ids);
        selection_anchor_task_id = id;
        return;
      }
    }
    if (ids.some((selected_id) => selected_id === id)) {
      ids = ids.filter((selected_id) => selected_id !== id);
    } else {
      ids.push(id);
    }
    selected_task_ids_.as(ids);
    selection_anchor_task_id = id;
  }

  function request_create_task() {
    create_task_text_.as("");
    create_task_filename_.as("");
    create_task_preview_.as(null);
    ui.createTaskDialog$.show();
  }

  function request_create_platform_task() {
    create_platform_text_.as("");
    create_platform_json_.as("");
    create_platform_download_dir_.as("");
    create_platform_filename_.as("");
    create_platform_download_cover_.as(false);
    create_platform_preview_.as(null);
    ui.createPlatformTaskDialog$.show();
  }

  function request_task_preview(task) {
    const task_id = task_identifier(task);
    if (task_id === undefined || task_id === null || task_id === "") {
      DLUtils.error({ msg: "无法打开详情：下载任务 ID 为空" });
      return;
    }
    preview_task_id_.as(String(task_id));
    ui.taskPreviewDrawer$.show();
  }

  function extract_filename(value) {
    try {
      const url = new URL(String(value || ""));
      const filename = url.pathname.split("/").filter(Boolean).pop() || "";
      return decodeURIComponent(filename);
    } catch {
      return "";
    }
  }

  function set_create_task_text(value) {
    create_task_text_.as(value || "");
    const filename = extract_filename(value);
    if (filename) create_task_filename_.as(filename);
  }

  async function confirm_create_task() {
    if (creating_task_.value) return;
    const url = String(create_task_text_.value || "").trim();
    if (!url) {
      DLUtils.warning({ msg: "请输入下载地址" });
      return;
    }
    creating_task_.as(true);
    try {
      const preview = await downloader.prepare({
        url,
        filename: create_task_filename_.value || "",
      });
      create_task_preview_.as(preview);
      ui.createTaskDialog$.hide();
      ui.createTaskPreviewDialog$.show();
    } catch (error) {
      report_error(error, "准备下载任务失败");
    } finally {
      creating_task_.as(false);
    }
  }

  function normalize_platform_preview(preview, fallback) {
    if (!preview || typeof preview !== "object") return preview;
    if (Array.isArray(preview.resources)) return preview;
    const task_record =
      preview.Task && typeof preview.Task === "object" ? preview.Task : {};
    const source_resources = Array.isArray(preview.Resources) ? preview.Resources : [];
    const resources = source_resources.map((item, index) => {
      const resource = item && item.Resource ? item.Resource : item || {};
      return {
        index,
        name: resource.name || resource.Name || `资源 ${index + 1}`,
        kind: resource.kind || resource.Kind || "",
        type: resource.type || resource.Type || "",
        endpoints:
          (item && (item.Endpoints || item.endpoints)) ||
          resource.endpoints ||
          [],
      };
    });
    return {
      platform:
        task_record.platform_id ||
        task_record.PlatformID ||
        fallback.platform ||
        "",
      task_name:
        task_record.name || task_record.Name || fallback.filename || "",
      download_dir: fallback.download_dir || "",
      resource_type: resources[0]
        ? resources[0].kind || resources[0].type || ""
        : "",
      resources,
      resource_count: resources.length,
      endpoint_count: resources.reduce((count, resource) => {
        return count + (Array.isArray(resource.endpoints) ? resource.endpoints.length : 0);
      }, 0),
      content: preview.Content || preview.content || null,
      account: preview.Account || preview.account || null,
      download_info: preview,
    };
  }

  async function confirm_create_platform_task() {
    if (creating_task_.value) return;
    const platform = String(create_platform_text_.value || "").trim();
    if (!platform) {
      DLUtils.warning({ msg: "请输入平台名称" });
      return;
    }
    let content = {};
    try {
      content = JSON.parse(String(create_platform_json_.value || "{}").trim() || "{}");
    } catch (error) {
      DLUtils.warning({ msg: `内容 JSON 格式错误：${error.message}` });
      return;
    }
    creating_task_.as(true);
    try {
      const prepare_object = {
        platform,
        content,
        download_dir: create_platform_download_dir_.value || "",
        filename: create_platform_filename_.value || "",
        config: {
          download_cover: create_platform_download_cover_.value,
        },
      };
      const preview = await downloader.prepare(prepare_object);
      create_platform_preview_.as(
        normalize_platform_preview(preview, prepare_object),
      );
      ui.createPlatformTaskDialog$.hide();
      ui.createPlatformTaskPreviewDialog$.show();
    } catch (error) {
      report_error(error, "准备平台下载任务失败");
    } finally {
      creating_task_.as(false);
    }
  }

  function duplicate_error(error) {
    const code = Number(
      error &&
        (error.code ||
          error.status ||
          (error.item && error.item.code) ||
          (error.data && error.data.code)),
    );
    if (code === 409) return true;
    return /already exists|duplicate|已存在|重复/i.test(
      (error && error.message) || "",
    );
  }

  function create_object_name(object, error) {
    const data = (error && error.data) || {};
    const content = object && object.content;
    return (
      data.name ||
      (object && (object.filename || object.name || object.title)) ||
      (content && (content.title || content.name || content.id)) ||
      "相同下载内容"
    );
  }

  function close_overwrite_dialogs() {
    ui.overwriteConfirmDialog$.hide();
    ui.singleOverwriteConfirmDialog$.hide();
    ui.batchOverwriteConfirmDialog$.hide();
  }

  function show_overwrite_dialog(object, error) {
    pending_create_object = object;
    overwrite_.as({ value: "overwrite" });
    overwrite_apply_all_.as(false);
    overwrite_conflict_.as({
      index: 1,
      total: 1,
      name: create_object_name(object, error),
    });
    ui.createTaskPreviewDialog$.hide();
    ui.createPlatformTaskPreviewDialog$.hide();
    ui.overwriteConfirmDialog$.show();
  }

  async function create_domain_task(object, success_message, options = {}) {
    try {
      const task$ =
        object &&
        object.platform &&
        Object.prototype.hasOwnProperty.call(object, "content")
          ? await downloader.create(object.content, object)
          : await downloader.create(object);
      await load_page(page_.value);
      if (options.hideDialog) options.hideDialog.hide();
      DLUtils.toast(success_message);
      return task$;
    } catch (error) {
      if (!options.overwriteRetry && duplicate_error(error)) {
        show_overwrite_dialog(object, error);
        return null;
      }
      report_error(error, "创建下载任务失败");
      return null;
    }
  }

  async function confirm_create_task_from_preview() {
    if (creating_task_.value || !create_task_preview_.value) return;
    creating_task_.as(true);
    try {
      return await create_domain_task(
        {
          url: create_task_text_.value || create_task_preview_.value.url || "",
          filename:
            create_task_filename_.value ||
            create_task_preview_.value.task_name ||
            "",
        },
        "下载任务创建成功",
        { hideDialog: ui.createTaskPreviewDialog$ },
      );
    } finally {
      creating_task_.as(false);
    }
  }

  async function confirm_create_platform_task_from_preview() {
    if (creating_task_.value || !create_platform_preview_.value) return;
    let content = {};
    try {
      content = JSON.parse(create_platform_json_.value || "{}");
    } catch {
      content = {};
    }
    const object = {
      platform:
        create_platform_text_.value || create_platform_preview_.value.platform || "",
      content,
      download_dir: create_platform_download_dir_.value || "",
      filename: create_platform_filename_.value || "",
      config: {
        download_cover: create_platform_download_cover_.value,
      },
    };
    creating_task_.as(true);
    try {
      return await create_domain_task(object, "平台下载任务创建成功", {
        hideDialog: ui.createPlatformTaskPreviewDialog$,
      });
    } finally {
      creating_task_.as(false);
    }
  }

  function set_overwrite_action(action) {
    if (["overwrite", "skip", "duplicate"].includes(action)) {
      overwrite_.as({ value: action });
    }
  }

  function toggle_overwrite_apply_all() {
    overwrite_apply_all_.as(!overwrite_apply_all_.value);
  }

  async function confirm_overwrite_download_conflict() {
    if (overwrite_processing_.value || !pending_create_object) return;
    const action = overwrite_.value && overwrite_.value.value;
    if (!["overwrite", "skip", "duplicate"].includes(action)) return;
    if (action === "skip") {
      pending_create_object = null;
      close_overwrite_dialogs();
      return;
    }
    overwrite_processing_.as(true);
    try {
      const object = {
        ...pending_create_object,
        config: {
          ...(pending_create_object.config || {}),
          overwrite: action === "overwrite",
          duplicate: action === "duplicate",
        },
      };
      const task$ = await create_domain_task(object, "下载任务创建成功", {
        overwriteRetry: true,
      });
      if (task$) {
        pending_create_object = null;
        close_overwrite_dialogs();
      }
    } finally {
      overwrite_processing_.as(false);
    }
  }

  function handle_click_delete_files() {
    delete_delete_files_.as(!delete_delete_files_.value);
  }

  function set_list_view_element(element) {
    list_view_element = element || null;
  }

  function handle_list_view_scroll(position) {
    scroll_top = Number(position && (position.scrollTop ?? position.top ?? position)) || 0;
  }

  function is_placeholder_task() {
    return false;
  }

  function ensure_task_page_for_index() {}

  Object.assign(methods, {
    setStatusFilter: set_status_filter,
    changePage: change_page,
    previousPage: previous_page,
    nextPage: next_page,
    refreshTasks: refresh_tasks,
    startTask: start_task,
    pauseTask: pause_task,
    resumeTask: resume_task,
    retryTask: retry_task,
    showTaskFileURL: show_task_file_url,
    copyTaskFileURL: copy_task_file_url,
    downloadTaskFile: download_task_file,
    extractAudio: extract_audio,
    rerunAudioStems: rerun_audio_stems,
    downloadAudioStem: download_audio_stem,
    openTranscript: open_transcript,
    rerunTranscript: rerun_transcript,
    copyTranscript: copy_transcript,
    openReverse: open_reverse,
    rerunReverse: rerun_reverse,
    copyReverse: copy_reverse,
    openReverseReport: open_reverse_report,
    openRemakeReverseReport: open_remake_reverse_report,
    openWhiteModel: open_white_model,
    runWhiteModel: run_white_model,
    openRemake: open_remake,
    openAnalyze: open_analyze,
    bootRemakeFromQuery: boot_remake_from_query,
    remakePageHref: remake_page_href,
    previewRemakePrompt: run_remake_reverse,
    runRemakeReverse: run_remake_reverse,
    runRemake: run_remake,
    downloadRemake: download_remake,
    pickRemakeModel(value) {
      const current = normalize_remake_reference();
      current.model = ["hailuo", "hailuo-2-3", "buming-h3", "wan-3-0"].includes(value)
        ? value
        : "mu-video";
      remake_reference_.as(current);
    },
    pickRemakeReference(value) {
      const current = normalize_remake_reference();
      if (
        current.model !== "hailuo" &&
        current.model !== "buming-h3" &&
        current.model !== "wan-3-0"
      ) return;
      if (value === "source") current.source = !current.source;
      if (value === "white" && current.whiteReady) current.white = !current.white;
      remake_reference_.as(current);
      sync_remake_run_button();
    },
    pickRemakeShotMode(value) {
      remake_shot_mode_.as(value === "plot" ? "plot" : "scene");
    },
    pickRemakeCutStep(value) {
      if (remake_cut_busy_.value) return;
      const step = Number(value);
      remake_cut_step_.as(step === 15 || step === 10 ? step : 5);
    },
    runRemakeCut() {
      return run_remake_cut();
    },
    openCutWhiteModel(clip) {
      return open_cut_white_model(clip);
    },
    toggleCutWhite(id) {
      return toggle_cut_white(id);
    },
    openCutReverse(clip) {
      return open_cut_reverse(clip);
    },
    previewCutPrompt(clip) {
      return preview_cut_prompt(clip);
    },
    runCutRemake(clip) {
      return run_cut_remake(clip);
    },
    openCutResults(id) {
      return open_cut_results(id);
    },
    updateCutPrompt(id, text) {
      update_cut_prompt(id, text);
    },
    pickRemakeStoryModel(value) {
      return pick_remake_story_model(value);
    },
    pickRemakePromptLlm(value) {
      return pick_remake_prompt_llm(value);
    },
    toggleRemakeStoryRef(refId) {
      return toggle_remake_story_ref(refId);
    },
    toggleRemakeStoryFrameRef(shotId) {
      return toggle_remake_story_frame_ref(shotId);
    },
    toggleRemakeStoryResultRef(shotId) {
      return toggle_remake_story_result_ref(shotId);
    },
    uploadRemakeStoryRefs(fileList) {
      return upload_remake_story_refs(fileList);
    },
    removeRemakeStoryRef(refId) {
      return remove_remake_story_ref(refId);
    },
    runRemakeShots() {
      return run_remake_shots();
    },
    runRemakeStoryboard(shotId) {
      return run_remake_storyboard(shotId);
    },
    runRemakeStoryPrompts(shotId) {
      return run_remake_story_prompts(shotId);
    },
    runRemakeStoryScript(shotId) {
      return run_remake_story_script(shotId);
    },
    runRemakeStoryVideo(shotId) {
      return run_remake_story_video(shotId);
    },
    updateRemakeStoryPrompt(shotId, prompt) {
      return update_remake_story_prompt(shotId, prompt);
    },
    updateRemakeStoryVideoPrompt(shotId, prompt) {
      return update_remake_story_video_prompt(shotId, prompt);
    },
    updateRemakeStoryScript(shotId, script) {
      return update_remake_story_script(shotId, script);
    },
    openRemakeBoard(board) {
      return open_remake_board(board);
    },
    openRemakeStoryResultPicker(shotId) {
      return open_remake_story_result_picker(shotId);
    },
    closeRemakeBoard() {
      return close_remake_board();
    },
    stepRemakeBoard(delta) {
      return step_remake_board(delta);
    },
    focusRemakeBoard(index) {
      return focus_remake_board(index);
    },
    pickRemakeBoardGenerated() {
      return pick_remake_board_generated();
    },
    saveRemakeBoard() {
      return save_remake_board();
    },
    pickRemakeShot(shot) {
      return pick_remake_shot(shot);
    },
    pickRemakeImage(file) {
      remake_shot_id_.as("");
      show_remake_shots(remake_shot_frames, "");
      remake_image_file = file;
      remake_image_name_.as(file ? file.name : "可以不选参考图");
      sync_remake_run_button();
    },
    downloadWhiteModel: download_white_model,
    startAllTasks: start_all_tasks,
    pauseAllTasks: pause_all_tasks,
    requestDeleteTask: request_delete_task,
    requestDeleteSelectedTasks: request_delete_selected_tasks,
    confirmDeleteTask: confirm_delete_task,
    requestClearTasks: request_clear_tasks,
    confirmClearTasks: confirm_clear_tasks,
    setLoadedTasksSelected: set_loaded_tasks_selected,
    toggleLoadedTasksSelected: toggle_loaded_tasks_selected,
    taskSelectionState: task_selection_state,
    toggleTaskSelected: toggle_task_selected,
    requestCreateTask: request_create_task,
    requestCreatePlatformTask: request_create_platform_task,
    requestTaskPreview: request_task_preview,
    setCreateTaskText: set_create_task_text,
    confirmCreateTask: confirm_create_task,
    confirmCreatePlatformTask: confirm_create_platform_task,
    confirmCreateTaskFromPreview: confirm_create_task_from_preview,
    confirmCreatePlatformTaskFromPreview:
      confirm_create_platform_task_from_preview,
    setOverwriteAction: set_overwrite_action,
    toggleOverwriteApplyAll: toggle_overwrite_apply_all,
    confirmOverwriteDownloadConflict: confirm_overwrite_download_conflict,
    handleClickCheckboxConfirmDeleteFiles: handle_click_delete_files,
    setListViewElement: set_list_view_element,
    handleListViewScroll: handle_list_view_scroll,
    isPlaceholderTask: is_placeholder_task,
    ensureTaskPageForIndex: ensure_task_page_for_index,
    taskCoverURL: task_cover_url,
  });

  const state = {
    tasks: tasks_,
    task_count: task_count_,
    total: filtered_task_count_,
    page: page_,
    page_size: page_size_,
    page_count: page_count_,
    range_text: range_text_,
    list_render_enabled: list_render_enabled_,
    delete_task: delete_task_,
    delete_task_ids: delete_task_ids_,
    pending_delete_task_count: pending_delete_task_count_,
    delete_delete_files: delete_delete_files_,
    deleting_task: deleting_task_,
    selected_task_ids: selected_task_ids_,
    selected_task_count: selected_task_count_,
    loaded_task_selection: loaded_task_selection_,
    clearing_tasks: clearing_tasks_,
    transcript_jobs: transcript_jobs_,
    transcript_title: transcript_title_,
    transcript_text: transcript_text_,
    transcript_message: transcript_message_,
    transcript_action_label: transcript_action_label_,
    transcript_path: transcript_path_,
    audio_jobs: audio_jobs_,
    audio_title: audio_title_,
    audio_message: audio_message_,
    audio_status: audio_status_,
    audio_action_label: audio_action_label_,
    audio_stems: audio_stems_,
    reverse_jobs: reverse_jobs_,
    reverse_title: reverse_title_,
    reverse_text: reverse_text_,
    reverse_message: reverse_message_,
    reverse_action_label: reverse_action_label_,
    reverse_vlm: reverse_vlm_,
    reverse_vlm_frames: reverse_vlm_frames_,
    white_model_jobs: white_model_jobs_,
    white_model_title: white_model_title_,
    white_model_message: white_model_message_,
    white_model_error: white_model_error_,
    white_model_url: white_model_url_,
    white_model_progress: white_model_progress_,
    white_model_contrast: white_model_contrast_,
    white_model_relief: white_model_relief_,
    white_model_detail: white_model_detail_,
    remake_jobs: remake_jobs_,
    remake_page_label: remake_page_label_,
    remake_title: remake_title_,
    remake_message: remake_message_,
    remake_url: remake_url_,
    remake_progress: remake_progress_,
    remake_reference: remake_reference_,
    remake_image_name: remake_image_name_,
    remake_shots: remake_shots_,
    remake_story_rows: remake_story_rows_,
    remake_story_busy_map: remake_story_busy_map_,
    remake_board_preview: remake_board_preview_,
    remake_shot_mode: remake_shot_mode_,
    remake_cut_step: remake_cut_step_,
    remake_cut_busy: remake_cut_busy_,
    remake_cuts: remake_cuts_,
    remake_cut_message: remake_cut_message_,
    remake_story_model: remake_story_model_,
    remake_prompt_llm: remake_prompt_llm_,
    remake_story_refs: remake_story_refs_,
    remake_story_script: remake_story_script_,
    remake_reverse_label: remake_reverse_label_,
    remake_shot_message: remake_shot_message_,
    remake_shot_busy: remake_shot_busy_,
    remake_shot_phase: remake_shot_phase_,
    remake_prompt: remake_prompt_,
    file_url: file_url_,
    file_url_title: file_url_title_,
    create_task_text: create_task_text_,
    create_task_filename: create_task_filename_,
    create_platform_text: create_platform_text_,
    create_platform_json: create_platform_json_,
    create_platform_download_dir: create_platform_download_dir_,
    create_platform_filename: create_platform_filename_,
    create_platform_download_cover: create_platform_download_cover_,
    creating_task: creating_task_,
    create_task_preview: create_task_preview_,
    create_platform_preview: create_platform_preview_,
    preview_task_id: preview_task_id_,
    websocket_connected: downloader.websocket_connected,
    websocket_connecting: downloader.websocket_connecting,
    status_counts: status_counts_,
    active_status: active_status_,
    initial: initial_,
    status: list_status_,
    loading: loading_,
    error: error_,
    overwrite: overwrite_,
    overwrite_apply_all: overwrite_apply_all_,
    overwrite_processing: overwrite_processing_,
    overwrite_conflict: overwrite_conflict_,
    fixed_list_height: Boolean(fixed_list_height),
    list_item_height: Math.max(1, Number(item_height) || 82),
    list_gutter: 0,
    list_height: Math.max(1, Number(list_height) || 380),
    list_size: 50,
    list_buffer: Math.max(0, Number(list_buffer) || 10),
    get scrollTop() {
      return scroll_top;
    },
  };
  const handler = {
    applyListMeta: apply_list_meta,
    rebuildDerivedState: rebuild_derived_state,
    syncDomainTasks: sync_domain_tasks,
  };

  async function ready() {
    if (started) return load_page(page_.value);
    started = true;
    start_live_refresh();
    const unlisten = downloader.task_list.subscribe({
      onChange() {
        sync_domain_tasks();
      },
    });
    if (typeof unlisten === "function") disposables.push(unlisten);
    if (downloader.list_meta && typeof downloader.list_meta.subscribe === "function") {
      const unlisten_meta = downloader.list_meta.subscribe({
        onChange(meta) {
          apply_list_meta(meta);
        },
      });
      if (typeof unlisten_meta === "function") disposables.push(unlisten_meta);
    }
    sync_domain_tasks();
    try {
      const results = await Promise.allSettled([
        load_page(page_.value),
        typeof downloader.connect === "function"
          ? downloader.connect()
          : Promise.resolve(false),
      ]);
      if (results[0].status === "rejected") throw results[0].reason;
      return {
        tasks: downloader.task_list,
        connected: !!(
          downloader.websocket_connected &&
          downloader.websocket_connected.value
        ),
        results,
      };
    } catch (error) {
      report_error(error, "下载服务初始化失败");
      return null;
    }
  }

  function clean() {
    if (disposed) return;
    disposed = true;
    stop_live_refresh();
    stop_white_model_poll();
    stop_reverse_poll();
    stop_audio_poll();
    request_sequence += 1;
    loading_.as(false);
    disposables.splice(0).forEach((unlisten) => {
      if (typeof unlisten === "function") unlisten();
    });
    Object.values(ui).forEach((store) => {
      if (typeof store.destroy === "function") store.destroy();
    });
  }

  Object.assign(methods, {
    ready,
    clean,
    loadPage: load_page,
    applyListMeta: handler.applyListMeta,
    rebuildDerivedState: handler.rebuildDerivedState,
    syncDomainTasks: handler.syncDomainTasks,
  });

  return { state, ui, methods };
}

export {
  DownloadV2Model,
  format_download_percent,
  format_download_size,
  format_download_speed,
  is_download_open_external,
  is_download_waiting_status,
  normalize_download_status,
};
