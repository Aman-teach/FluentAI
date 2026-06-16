create table if not exists vocabulary_words (
  id text primary key,
  browser_id text not null,
  word text not null,
  meaning text default '',
  example text default '',
  phonetic text default '',
  box integer default 0,
  added bigint not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists vocabulary_words_browser_id_idx
  on vocabulary_words (browser_id);

create index if not exists vocabulary_words_word_idx
  on vocabulary_words (word);
