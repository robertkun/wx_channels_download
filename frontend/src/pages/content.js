import {
  Button,
  Checkbox,
  Dialog,
  DialogBody,
  DialogTitle,
  PlatformTag,
  Tag,
  createCheckboxStore,
} from "../dmui.js";
import { ContentViewModel } from "./content.model.js";
import { DownloadV2RemakeDialog, WhiteModelControls } from "./downloadv2.components.js";
import ContentDetailPageView from "./content_detail.js";

function ContentDetailDrawer(props) {
  const vm$ = props.store;
  return Drawer(
    {
      store: vm$.ui.contentDetailDrawer$,
      class: "dm-drawer--wide",
      attributes: { n: "content-detail-drawer" },
    },
    () => [
      ContentDetailPageView({
        app: props.app,
        client: props.client,
        hlsPlayer: props.hlsPlayer,
        history: props.history,
        embedded: true,
        contentId: vm$.state.detail_id,
        onBack() {
          vm$.ui.contentDetailDrawer$.hide();
        },
      }),
    ],
  );
}

function ContentPageView(props) {
  const vm$ = ContentViewModel(props);
  return View(
    {
      class: "content-page content-library-page content-list-page page",
      onMounted() {
        vm$.methods.ready();
      },
      onUnmounted() {
        vm$.methods.clean();
      },
    },
    [
      View({ class: "content-toolbar-wrap" }, [
        ContentPageToolbar({ store: vm$ }),
      ]),
      ContentPageBody({ store: vm$ }),
      ContentTranscriptDialog({ store: vm$ }),
      ContentReverseDialog({ store: vm$ }),
      ContentFileURLDialog({ store: vm$ }),
      ContentWhiteModelDialog({ store: vm$ }),
      DownloadV2RemakeDialog({ store: vm$ }),
      ContentDeleteDialog({ store: vm$ }),
      ContentDetailDrawer({
        store: vm$,
        app: props.app,
        client: props.client,
        hlsPlayer: props.hlsPlayer,
        history: props.history,
      }),
    ],
  );
}

function ContentPageActionButton(props) {
  const semantic_name = props.name || "content-action";
  return Button(
    {
      store: props.store,
      class: "dm-button--toolbar",
      attributes: {
        n: semantic_name,
        type: (props.attributes && props.attributes.type) || "button",
        title: props.title || "",
        ...(props.attributes || {}),
      },
      onClick: props.onClick,
      prefix: props.icon
        ? Timeless.Icon({
            name: props.icon,
            size: props.iconSize || 16,
            attributes: { n: `${semantic_name}-icon` },
          })
        : null,
    },
    props.label ? [props.label] : [],
  );
}

function ContentPageToolbar(props) {
  const vm$ = props.store;
  return View(
    {
      type: "form",
      class: "content-toolbar content-filter-form",
      attributes: { role: "search" },
      onSubmit(event) {
        event.preventDefault();
        vm$.methods.search();
      },
    },
    [
      View(
        {
          class: "content-filter-fields dm-flex dm-items-center dm-gap-2",
        },
        [
          View({}, [
            PlatformSelect({
              store: vm$.ui.select_platform$,
              // class: "content-filter-select",
              attributes: {
                "aria-label": "按平台筛选内容",
              },
            }),
          ]),
          View({}, [
            AccountSelect({
              store: vm$.ui.select_account$,
              platform: vm$.state.platform_id,
              style: { width: "180px" },
              attributes: {
                "aria-label": "按账号筛选内容",
              },
            }),
          ]),
          View(
            {
              // class: "content-filter-search",
              style: { flex: "1" },
              attributes: { n: "content-search-field" },
            },
            [
              Input({
                store: vm$.ui.input_keyword$,
                rootAttributes: { n: "content-search-control" },
                prefix: Timeless.Icon({
                  name: "search",
                  size: 16,
                  attributes: { n: "content-search-icon" },
                }),
                attributes: {
                  n: "content-search-input",
                  name: "keyword",
                  type: "search",
                  autocomplete: "off",
                  "aria-label": "搜索内容标题或描述",
                },
              }),
            ],
          ),
          // Select({
          //   store: vm$.ui.select_content_type$,
          //   class: "content-type-select content-filter-select",
          //   attributes: { "aria-label": "筛选内容类型" },
          // }),
        ],
      ),
      View(
        {
          class: "content-filter-actions dm-flex dm-items-center dm-gap-2",
        },
        [
          ContentPageActionButton({
            name: "content-search-action",
            store: vm$.ui.btn_search$,
            icon: "search",
            label: "搜索",
            variant: "primary",
            attributes: { type: "submit" },
            onClick(event) {
              event.preventDefault();
              vm$.methods.search();
            },
          }),
          ContentPageActionButton({
            name: "content-reset-action",
            store: vm$.ui.btn_refresh$,
            icon: "rotate-ccw",
            label: "重置",
          }),
          View(
            {
              class: "content-scope-toggle",
              attributes: { n: "content-scope-toggle" },
            },
            [
              Checkbox({
                store: vm$.ui.checkbox_all$,
                id: "wxContentScopeAll",
                text: "所有",
                textAttributes: { n: "content-scope-all-text" },
                attributes: {
                  n: "content-scope-all-checkbox",
                  "aria-label": "显示所有内容",
                },
              }),
            ],
          ),
        ],
      ),
    ],
  );
}

function content_cover_url(content) {
  return String((content && content.cover_url) || "").trim();
}

function ContentRowCover(props) {
  const content = props.content;
  const cover_url = content_cover_url(content);
  if (!cover_url) return null;
  return View({ class: "content-row-cover-wrap" }, [
    LazyImg({
      class: "content-row-cover",
      src: cover_url,
      alt: content.title,
      attributes: {
        referrerpolicy: "no-referrer",
      },
    }),
  ]);
}

function ContentRowAccounts(props) {
  const accounts = props.content.accounts || [];
  if (accounts.length === 0) {
    return ["暂无关联账号"];
  }
  return [
    For({
      each: accounts,
      render(account_) {
        const account =
          account_ && account_.value !== undefined ? account_.value : account_;
        const name =
          account.nickname || account.alias || account.external_id || "未知";
        return View(
          {
            class:
              "content-row-author-account dm-flex dm-items-center dm-gap-1-5 dm-min-w-0",
          },
          [
            Show({
              when: account.avatar_url,
              ok() {
                return LazyImg({
                  class: "content-row-author-avatar",
                  src: account.avatar_url,
                  alt: name,
                  attributes: {
                    loading: "lazy",
                    referrerpolicy: "no-referrer",
                  },
                });
              },
            }),
            View(
              {
                class: "content-row-author-name",
                attributes: { title: name },
              },
              [name],
            ),
          ],
        );
      },
    }),
  ];
}

function ContentRowStatistics(props) {
  const statistics = props.statistics;
  const items = [
    ...statistics.task_statuses,
    { key: "files", label: "文件", value: statistics.files },
  ].filter((item) => item.value > 0);
  return [
    For({
      each: items,
      render(item) {
        return Tag(
          {
            name: "content-row-stat",
            class: `content-row-stat content-row-stat-${item.key}`,
            attributes: { title: `${item.label}：${item.value}` },
          },
          [
            View({ class: "content-row-stat-value" }, [String(item.value)]),
            View({ class: "content-row-stat-label" }, [item.label]),
          ],
        );
      },
    }),
  ];
}

function ContentRowMain(props) {
  const vm$ = props.store;
  const content = props.content;
  const favicon = window.PLATFORM_FAVICONS[content.platform_id] || "";
  const title = content.title || "\u00a0";
  const copied_ = computed(
    vm$.state.copied_content_id,
    (copied_content_id) => copied_content_id === content.id,
  );
  return [
    ContentRowCover({ content }),
    View({ class: "content-row-main dm-min-w-0 dm-flex-1" }, [
      View(
        {
          class: "content-row-title",
          attributes: { title: content.title },
        },
        [title],
      ),
      View(
        {
          class: "content-row-id",
          attributes: { n: "content-id" },
        },
        [
          View(
            {
              type: "button",
              class: computed(copied_, (copied) =>
                copied
                  ? "content-copy-id-action dm-focus-ring is-copied"
                  : "content-copy-id-action dm-focus-ring",
              ),
              attributes: {
                n: "content-copy-id-action",
                type: "button",
                title: computed(copied_, (copied) =>
                  copied ? "已复制" : "复制内容 ID",
                ),
                "aria-label": computed(copied_, (copied) =>
                  copied ? "内容 ID 已复制" : "复制内容 ID",
                ),
                disabled: content.id ? undefined : true,
              },
              onClick(event) {
                event.stopPropagation();
                vm$.methods.copyId(content);
              },
            },
            [
              Show({
                when: copied_,
                ok() {
                  return Timeless.Icon({
                    name: "check",
                    size: 12,
                    attributes: { n: "content-copy-id-success-icon" },
                  });
                },
                else() {
                  return Timeless.Icon({
                    name: "copy",
                    size: 12,
                    attributes: { n: "content-copy-id-icon" },
                  });
                },
              }),
            ],
          ),
          View(
            {
              class: "content-row-id-value",
              attributes: {
                n: "content-id-value",
                title: content.id || "",
              },
            },
            [content.id || "-"],
          ),
        ],
      ),
      View(
        {
          class: "content-row-badges dm-flex dm-items-center dm-gap-1-5",
        },
        [
          PlatformTag({
            name: "content-platform",
            favicon,
            label: vm$.methods.platformName(content),
          }),
          Tag({ name: "content-row-type", class: "content-row-type" }, [
            vm$.methods.typeLabel(content.content_type),
          ]),
          Show({
            when: content.content_subtype,
            ok() {
              return Tag(
                {
                  class: "content-row-type content-row-subtype",
                  attributes: {
                    n: "content-subtype",
                    title: `subtype: ${content.content_subtype}`,
                  },
                },
                [content.content_subtype],
              );
            },
          }),
        ],
      ),
    ]),
  ];
}

function ContentSkeletonRow() {
  return View(
    {
      class: "dm-table-row dm-grid dm-items-center content-skeleton-row",
      attributes: { n: "content-table-skeleton-row", role: "row" },
    },
    [
      View(
        {
          class:
            "dm-table-cell content-row-main-cell dm-flex dm-items-center dm-gap-4 dm-min-w-0",
          attributes: { n: "content-table-skeleton-main-cell", role: "cell" },
        },
        [
          View({
            class: "content-row-cover content-skeleton",
            attributes: { n: "content-table-skeleton-cover" },
          }),
          View(
            {
              class: "content-row-main dm-min-w-0 dm-flex-1",
              attributes: { n: "content-table-skeleton-main" },
            },
            [
              View({
                class: "content-skeleton content-skeleton-title",
                attributes: { n: "content-table-skeleton-title" },
              }),
              View({
                class: "content-skeleton content-skeleton-tag",
                attributes: { n: "content-table-skeleton-tag" },
              }),
            ],
          ),
        ],
      ),
      View(
        {
          class: "dm-table-cell",
          attributes: { n: "content-table-skeleton-account", role: "cell" },
        },
        [
          View({
            class: "content-skeleton content-skeleton-line",
            attributes: { n: "content-table-skeleton-account-value" },
          }),
        ],
      ),
      View(
        {
          class: "dm-table-cell",
          attributes: { n: "content-table-skeleton-time", role: "cell" },
        },
        [
          View({
            class: "content-skeleton content-skeleton-line-short",
            attributes: { n: "content-table-skeleton-time-value" },
          }),
        ],
      ),
      View(
        {
          class: "dm-table-cell",
          attributes: {
            n: "content-table-skeleton-statistics",
            role: "cell",
          },
        },
        [
          View({
            class: "content-skeleton content-skeleton-line-short",
            attributes: { n: "content-table-skeleton-statistics-value" },
          }),
        ],
      ),
      View(
        {
          class: "dm-table-cell content-row-actions",
          attributes: {
            n: "content-table-skeleton-actions",
            role: "cell",
          },
        },
        [
          View({
            class: "content-skeleton content-skeleton-line-short",
            attributes: { n: "content-table-skeleton-actions-value" },
          }),
        ],
      ),
    ],
  );
}

function ContentTranscriptDialog(props) {
  const vm$ = props.store;
  return Dialog(
    {
      store: vm$.ui.transcriptDialog$,
      class: "content-transcript-dialog",
      attributes: { n: "content-transcript-dialog" },
    },
    () => [
      DialogTitle(
        {
          class: "content-transcript-heading",
          attributes: { n: "content-transcript-heading" },
        },
        [
          View(
            {
              class: "content-transcript-title",
              attributes: { n: "content-transcript-title" },
            },
            [vm$.state.transcript_title],
          ),
          View(
            {
              class: "content-transcript-message",
              attributes: { n: "content-transcript-message" },
            },
            [vm$.state.transcript_message],
          ),
        ],
      ),
      DialogBody(
        {
          class: "content-transcript-body",
          attributes: { n: "content-transcript-body" },
        },
        [
          View(
            {
              class: "content-transcript-text",
              attributes: { n: "content-transcript-text" },
            },
            [
              computed(vm$.state.transcript_text, (text) =>
                text ? text : "文案会显示在这里。",
              ),
            ],
          ),
          View(
            {
              class: "content-transcript-actions",
              attributes: { n: "content-transcript-actions" },
            },
            [
              Button(
                {
                  store: vm$.ui.btn_transcript_copy$,
                  attributes: { n: "content-transcript-copy" },
                },
                ["复制文案"],
              ),
              Button(
                {
                  store: vm$.ui.btn_transcript_rerun$,
                  attributes: { n: "content-transcript-rerun" },
                },
                [
                  computed(vm$.state.transcript_action_label, (label) =>
                    label || "开始提取",
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    ],
  );
}

function stop_row_click(event) {
  if (event && typeof event.stopPropagation === "function") {
    event.stopPropagation();
  }
}

function ContentActionButton(props) {
  const disabled = Boolean(props.disabled);
  return View(
    {
      type: "button",
      class: [
        "content-row-action",
        props.danger ? "content-row-action-danger" : "",
        props.loading ? "is-loading" : "",
        disabled ? "is-disabled" : "",
      ]
        .filter(Boolean)
        .join(" "),
      attributes: {
        type: "button",
        title: props.title || "",
        "aria-label": props.title || "",
        "aria-disabled": disabled ? "true" : "false",
      },
      onClick(event) {
        stop_row_click(event);
        if (disabled) return;
        if (typeof props.onClick === "function") props.onClick(event);
      },
    },
    props.icon ? [Timeless.Icon({ name: props.icon, size: 18 })] : props.children || [],
  );
}

function ContentRemakeIcon() {
  return SVG.SVG(
    {
      attributes: {
        width: "18",
        height: "18",
        xmlns: "http://www.w3.org/2000/svg",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "2",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        "aria-hidden": "true",
      },
    },
    [
      SVG.Path({
        attributes: {
          d: "M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z",
        },
      }),
      SVG.Path({ attributes: { d: "m6.2 5.3 3.1 3.9" } }),
      SVG.Path({ attributes: { d: "m12.4 3.4 3.1 4" } }),
      SVG.Path({
        attributes: { d: "M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" },
      }),
    ],
  );
}

function ContentReverseIcon() {
  return SVG.SVG(
    {
      attributes: {
        width: "18",
        height: "18",
        xmlns: "http://www.w3.org/2000/svg",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "2",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        "aria-hidden": "true",
      },
    },
    [
      SVG.Path({ attributes: { d: "M3 7V5a2 2 0 0 1 2-2h2" } }),
      SVG.Path({ attributes: { d: "M17 3h2a2 2 0 0 1 2 2v2" } }),
      SVG.Path({ attributes: { d: "M21 17v2a2 2 0 0 1-2 2h-2" } }),
      SVG.Path({ attributes: { d: "M7 21H5a2 2 0 0 1-2-2v-2" } }),
      SVG.Circle({ attributes: { cx: "12", cy: "12", r: "3" } }),
      SVG.Path({ attributes: { d: "m16 16-1.9-1.9" } }),
    ],
  );
}

function ContentWhiteModelIcon() {
  return SVG.SVG(
    {
      attributes: {
        width: "18",
        height: "18",
        xmlns: "http://www.w3.org/2000/svg",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "2",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        class: "lucide lucide-box",
        "aria-hidden": "true",
      },
    },
    [
      SVG.Path({
        attributes: {
          d: "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z",
        },
      }),
      SVG.Path({ attributes: { d: "m3.3 7 8.7 5 8.7-5" } }),
      SVG.Path({ attributes: { d: "M12 22V12" } }),
    ],
  );
}

function ContentRowActions(props) {
  const vm$ = props.store;
  const content = props.content;
  const id = String(content.id || "");
  const has_file = Number(content.file_count) > 0;
  const transcript_job_ = computed(
    vm$.state.transcript_jobs,
    (jobs) => (jobs && jobs[id]) || "",
  );
  const reverse_job_ = computed(
    vm$.state.reverse_jobs,
    (jobs) => (jobs && jobs[id]) || "",
  );
  const white_model_job_ = computed(
    vm$.state.white_model_jobs,
    (jobs) => (jobs && jobs[id]) || "",
  );
  const remake_job_ = computed(
    vm$.state.remake_jobs,
    (jobs) => (jobs && jobs[id]) || "",
  );
  return [
    ContentActionButton({
      icon: "folder",
      title: "源站下载地址",
      onClick() {
        vm$.methods.showFileURL(content);
      },
    }),
    ContentActionButton({
      icon: "download",
      title: has_file ? "下载到本机" : "视频还没下载完成",
      disabled: !has_file,
      onClick() {
        vm$.methods.downloadFile(content);
      },
    }),
    View(
      {
        type: "button",
        class: computed(transcript_job_, (job) =>
          ["content-row-action", job === "loading" ? "is-loading" : ""]
            .filter(Boolean)
            .join(" "),
        ),
        attributes: {
          type: "button",
          title: computed(transcript_job_, (job) =>
            job === "loading" ? "提取中" : job === "ready" ? "查看文案" : "文案提取",
          ),
          "aria-label": computed(transcript_job_, (job) =>
            job === "loading" ? "提取中" : job === "ready" ? "查看文案" : "文案提取",
          ),
        },
        onClick(event) {
          stop_row_click(event);
          if (transcript_job_.value === "loading") return;
          vm$.methods.openTranscript(content);
        },
      },
      [Timeless.Icon({ name: "scroll-text", size: 18 })],
    ),
    View(
      {
        type: "button",
        class: computed(reverse_job_, (job) =>
          ["content-row-action", job === "loading" ? "is-loading" : ""]
            .filter(Boolean)
            .join(" "),
        ),
        attributes: {
          type: "button",
          title: computed(reverse_job_, (job) =>
            job === "loading" ? "反推中" : job === "ready" ? "查看反推" : "视频反推",
          ),
          "aria-label": computed(reverse_job_, (job) =>
            job === "loading" ? "反推中" : job === "ready" ? "查看反推" : "视频反推",
          ),
        },
        onClick(event) {
          stop_row_click(event);
          if (reverse_job_.value === "loading") return;
          vm$.methods.openReverse(content);
        },
      },
      [ContentReverseIcon()],
    ),
    View(
      {
        type: "button",
        class: computed(white_model_job_, (job) =>
          ["content-row-action", job === "loading" ? "is-loading" : ""]
            .filter(Boolean)
            .join(" "),
        ),
        attributes: {
          type: "button",
          title: computed(white_model_job_, (job) =>
            job === "loading" ? "转换中" : job === "ready" ? "查看白模" : "转白模",
          ),
          "aria-label": computed(white_model_job_, (job) =>
            job === "loading" ? "转换中" : job === "ready" ? "查看白模" : "转白模",
          ),
        },
        onClick(event) {
          stop_row_click(event);
          vm$.methods.openWhiteModel(content);
        },
      },
      [ContentWhiteModelIcon()],
    ),
    View(
      {
        type: "button",
        class: computed(remake_job_, (job) =>
          ["content-row-action", job === "loading" ? "is-loading" : ""]
            .filter(Boolean)
            .join(" "),
        ),
        attributes: {
          type: "button",
          title: computed(remake_job_, (job) =>
            job === "loading" ? "复刻中" : job === "ready" ? "查看复刻" : "视频复刻",
          ),
          "aria-label": computed(remake_job_, (job) =>
            job === "loading" ? "复刻中" : job === "ready" ? "查看复刻" : "视频复刻",
          ),
        },
        onClick(event) {
          stop_row_click(event);
          vm$.methods.openRemake(content);
        },
      },
      [ContentRemakeIcon()],
    ),
    ContentActionButton({
      icon: "trash2",
      title: "删除",
      danger: true,
      onClick() {
        vm$.methods.requestDelete(content);
      },
    }),
  ];
}

function ContentReverseVlmOption(props) {
  const vm$ = props.store;
  const checkbox = createCheckboxStore({
    checked: vm$.state.reverse_vlm,
  });
  return View({ class: "content-reverse-option" }, [
    View(
      {
        class: "content-reverse-vlm",
        attributes: { n: "content-reverse-vlm" },
        onClick() {
          checkbox.toggle();
        },
      },
      [
        Checkbox({
          store: checkbox,
          attributes: {
            n: "content-reverse-vlm-checkbox",
            "aria-label": "看图写分镜",
          },
          onClick(event) {
            event.stopPropagation();
          },
        }),
        View({ attributes: { n: "content-reverse-vlm-label" } }, ["看图写分镜"]),
      ],
    ),
    View(
      {
        class: "content-reverse-hint",
        attributes: { n: "content-reverse-vlm-hint" },
      },
      ["默认关闭。勾选后会看关键帧并写出每个镜头的提示词，不勾选则只拆镜头和声音。"],
    ),
  ]);
}

function ContentReverseDialog(props) {
  const vm$ = props.store;
  return Dialog(
    {
      store: vm$.ui.reverseDialog$,
      class: "content-transcript-dialog",
      attributes: { n: "content-reverse-dialog" },
    },
    () => [
      DialogTitle(
        {
          class: "content-transcript-heading",
          attributes: { n: "content-reverse-heading" },
        },
        [
          View(
            {
              class: "content-transcript-title",
              attributes: { n: "content-reverse-title" },
            },
            [vm$.state.reverse_title],
          ),
          View(
            {
              class: "content-transcript-message",
              attributes: { n: "content-reverse-message" },
            },
            [vm$.state.reverse_message],
          ),
        ],
      ),
      DialogBody(
        {
          class: "content-transcript-body",
          attributes: { n: "content-reverse-body" },
        },
        [
          View(
            {
              class: "content-transcript-text",
              attributes: { n: "content-reverse-text" },
            },
            [
              computed(vm$.state.reverse_text, (text) =>
                text ? text : "反推结果会显示在这里。",
              ),
            ],
          ),
          ContentReverseVlmOption({ store: vm$ }),
          View(
            {
              class: "content-transcript-actions",
              attributes: { n: "content-reverse-actions" },
            },
            [
              Button(
                {
                  store: vm$.ui.btn_reverse_copy$,
                  attributes: { n: "content-reverse-copy" },
                },
                ["复制结论"],
              ),
              Button(
                {
                  store: vm$.ui.btn_reverse_open$,
                  attributes: { n: "content-reverse-open" },
                },
                ["打开报告"],
              ),
              Button(
                {
                  store: vm$.ui.btn_reverse_rerun$,
                  attributes: { n: "content-reverse-rerun" },
                },
                [
                  computed(vm$.state.reverse_action_label, (label) =>
                    label || "开始反推",
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    ],
  );
}

function ContentFileURLDialog(props) {
  const vm$ = props.store;
  return Dialog(
    {
      store: vm$.ui.fileUrlDialog$,
      class: "content-file-url-dialog",
      attributes: { n: "content-file-url-dialog" },
    },
    () => [
      DialogTitle(
        {
          class: "content-transcript-heading",
          attributes: { n: "content-file-url-heading" },
        },
        [
          View(
            {
              class: "content-transcript-title",
              attributes: { n: "content-file-url-title" },
            },
            ["源站下载地址"],
          ),
          View(
            {
              class: "content-transcript-message",
              attributes: { n: "content-file-url-message" },
            },
            [vm$.state.file_url_title],
          ),
        ],
      ),
      DialogBody({}, [
        View(
          {
            class: "content-file-url",
            attributes: { n: "content-file-url" },
          },
          [
            computed(vm$.state.file_url, (url) =>
              url ? url : "没有保存源站下载地址。",
            ),
          ],
        ),
        View(
          {
            class: "content-transcript-actions",
            attributes: { n: "content-file-url-actions" },
          },
          [
            Button(
              {
                store: vm$.ui.btn_file_url_copy$,
                attributes: { n: "content-file-url-copy" },
              },
              ["复制地址"],
            ),
          ],
        ),
      ]),
    ],
  );
}

function ContentWhiteModelDialog(props) {
  const vm$ = props.store;
  return Dialog(
    {
      store: vm$.ui.whiteModelDialog$,
      class: "content-transcript-dialog",
      attributes: { n: "content-white-model-dialog" },
    },
    () => [
      DialogTitle(
        {
          class: "content-transcript-heading",
          attributes: { n: "content-white-model-heading" },
        },
        [
          View(
            {
              class: "content-transcript-title",
              attributes: { n: "content-white-model-title" },
            },
            [vm$.state.white_model_title],
          ),
          View(
            {
              class: "content-transcript-message",
              attributes: { n: "content-white-model-message" },
            },
            [vm$.state.white_model_message],
          ),
        ],
      ),
      DialogBody({ class: "content-white-model-body" }, [
        Show({
          when: computed(vm$.state.white_model_progress, (value) => Number(value) >= 0),
          ok() {
            return View(
              {
                class: "content-white-model-progress",
                attributes: { n: "content-white-model-progress" },
              },
              [
                View({
                  class: "content-white-model-progress-bar",
                  style: computed(vm$.state.white_model_progress, (value) => ({
                    width: `${Math.max(0, Math.min(100, Number(value) || 0))}%`,
                  })),
                }),
              ],
            );
          },
        }),
        Show({
          when: computed(vm$.state.white_model_url, (url) => Boolean(url)),
          ok() {
            return Timeless.Video({
              class: "content-white-model-video",
              src: vm$.state.white_model_url,
              controls: true,
              playsInline: true,
              preload: "metadata",
              attributes: { n: "content-white-model-video" },
            });
          },
          else() {
            return Show({
              when: computed(vm$.state.white_model_error, (value) =>
                Boolean(String(value || "").trim()),
              ),
              ok() {
                return View(
                  {
                    class: "content-white-model-raw",
                    attributes: { n: "content-white-model-raw" },
                  },
                  [
                    View({ class: "content-white-model-raw-label" }, ["原始报错"]),
                    View(
                      {
                        as: "pre",
                        class: "content-white-model-raw-text",
                      },
                      [vm$.state.white_model_error],
                    ),
                  ],
                );
              },
              else() {
                return View(
                  {
                    class: "content-white-model-empty",
                    attributes: { n: "content-white-model-empty" },
                  },
                  ["白模视频会显示在这里。"],
                );
              },
            });
          },
        }),
        WhiteModelControls({ store: vm$ }),
        View(
          {
            class: "content-transcript-actions",
            attributes: { n: "content-white-model-actions" },
          },
          [
            Button(
              {
                store: vm$.ui.btn_white_model_download$,
                attributes: { n: "content-white-model-download" },
              },
              ["下载白模"],
            ),
            Button(
              {
                store: vm$.ui.btn_white_model_run$,
                attributes: { n: "content-white-model-run" },
              },
              [
                computed(vm$.state.white_model_url, (url) =>
                  url ? "重新转换" : "转白模",
                ),
              ],
            ),
          ],
        ),
      ]),
    ],
  );
}

function ContentDeleteDialog(props) {
  const vm$ = props.store;
  const checkbox = createCheckboxStore({
    checked: vm$.state.delete_files,
  });
  return Dialog(
    {
      store: vm$.ui.deleteConfirmDialog$,
      zIndex: 10000,
      class: "dm-dialog--form",
      okText: "删除",
      attributes: { n: "content-delete-dialog" },
    },
    [
      DialogTitle(
        {
          class: "content-transcript-heading",
          attributes: { n: "content-delete-heading" },
        },
        [
          View(
            {
              class: "content-transcript-title",
              attributes: { n: "content-delete-title" },
            },
            ["删除下载任务"],
          ),
          View(
            {
              class: "content-transcript-message",
              attributes: { n: "content-delete-message" },
            },
            [
              computed(vm$.state.delete_task_count, (count) => {
                const total = Number(count) || 1;
                return `确定删除 ${total} 个下载任务记录？此操作不可恢复。`;
              }),
            ],
          ),
        ],
      ),
      DialogBody({}, [
        View(
          {
            class: "content-delete-files",
            attributes: { n: "content-delete-files" },
            onClick() {
              checkbox.toggle();
            },
          },
          [
            Checkbox({
              store: checkbox,
              attributes: {
                n: "content-delete-files-checkbox",
                "aria-label": "同时删除已下载的文件",
              },
              onClick(event) {
                event.stopPropagation();
              },
            }),
            View({ attributes: { n: "content-delete-files-label" } }, [
              "同时删除已下载的文件",
            ]),
          ],
        ),
      ]),
    ],
  );
}

function ContentPageBody(props) {
  const vm$ = props.store;
  return Table({
    name: "content-table",
    containerClass: "content-main container",
    containerAttributes: { n: "content-page-main" },
    panelAttributes: { n: "content-table-panel" },
    columns: [
      {
        name: "main",
        title: "封面 / 标题",
        width: "minmax(300px, 2fr)",
        cellClass:
          "content-row-main-cell dm-flex dm-items-center dm-gap-4 dm-min-w-0",
        render(content) {
          return ContentRowMain({ store: vm$, content });
        },
      },
      {
        name: "account",
        title: "账号",
        width: "minmax(150px, 1fr)",
        cellClass:
          "content-row-author dm-flex dm-items-center dm-gap-1-5 dm-min-w-0",
        render(content) {
          return ContentRowAccounts({ content });
        },
      },
      {
        name: "time",
        title: "时间",
        width: 240,
        cellClass:
          "content-row-meta dm-flex dm-items-center dm-gap-1-5 dm-text-muted dm-text-sm dm-tabular-nums dm-whitespace-nowrap",
        render(content) {
          return [
            View({ attributes: { n: "content-time" } }, [
              View({ attributes: { n: "content-publish-time" } }, [
                `发布时间: ${vm$.methods.formatTime(content.publish_time)}`,
              ]),
              View({ attributes: { n: "content-created-at" } }, [
                `创建时间: ${vm$.methods.formatTime(content.created_at)}`,
              ]),
            ]),
          ];
        },
      },
      {
        name: "statistics",
        title: "统计",
        width: 200,
        cellClass: "content-row-stats",
        render(content) {
          return ContentRowStatistics({
            statistics: vm$.methods.statistics(content),
          });
        },
      },
      {
        name: "actions",
        title: "操作",
        width: 348,
        cellClass: "content-row-actions",
        render(content) {
          return ContentRowActions({ store: vm$, content });
        },
      },
    ],
    rows: vm$.state.contents,
    pagination: {
      class: "container dm-px-4",
      summary: vm$.state.range_text,
      page: vm$.state.page,
      pageCount: vm$.state.page_count,
      pageSize: vm$.state.page_size,
      loading: vm$.state.initial,
      onChange(page) {
        return vm$.methods.changePage(page);
      },
    },
    status: vm$.state.status,
    loading: vm$.state.loading,
    error: vm$.state.error,
    skeletonCount: 8,
    renderSkeletonRow: ContentSkeletonRow,
    onRow(content) {
      const detail_href = vm$.methods.detailHref(content);
      return {
        class: detail_href ? "content-row-clickable" : "",
        attributes: detail_href ? { title: "查看内容详情" } : {},
        onClick() {
          vm$.methods.openDetail(content);
        },
      };
    },
    errorTitle: "内容加载失败",
    retry: {
      store: vm$.ui.btn_retry$,
    },
    emptyTitle: "暂无内容",
    emptyDescription: "当前筛选条件下没有内容",
  });
}

export default ContentPageView;
