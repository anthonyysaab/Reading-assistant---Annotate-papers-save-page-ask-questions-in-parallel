export const IPC = {
  file: {
    openDialog: "file:openDialog",
    ref: "file:ref",
    readBytes: "file:readBytes",
    readText: "file:readText",
    writeText: "file:writeText",
    revealInExplorer: "file:revealInExplorer",
    openExternal: "file:openExternal",
    watch: "file:watch",
    unwatch: "file:unwatch",
    changed: "file:changed"
  },
  doc: {
    extract: "doc:extract"
  },
  annotations: {
    list: "annotations:list",
    add: "annotations:add",
    update: "annotations:update",
    remove: "annotations:remove"
  },
  rag: {
    index: "rag:index",
    status: "rag:status",
    remove: "rag:remove",
    query: "rag:query",
    progress: "rag:progress"
  },
  llm: {
    chatStream: "llm:chatStream",
    abort: "llm:abort",
    models: "llm:models",
    token: "llm:token",
    done: "llm:done",
    error: "llm:error"
  },
  providers: {
    list: "providers:list",
    detectLocal: "providers:detectLocal",
    test: "providers:test",
    modules: "providers:modules"
  },
  threads: {
    save: "threads:save",
    load: "threads:load",
    list: "threads:list",
    remove: "threads:remove",
    export: "threads:export"
  },
  settings: {
    get: "settings:get",
    set: "settings:set",
    setSecret: "settings:setSecret",
    clearSecret: "settings:clearSecret"
  },
  health: {
    check: "health:check"
  },
  onboarding: {
    status: "onboarding:status",
    complete: "onboarding:complete"
  },
  search: {
    query: "search:query"
  },
  update: {
    check: "update:check",
    install: "update:install"
  }
} as const;
