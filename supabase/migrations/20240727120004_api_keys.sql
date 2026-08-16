alter table configuracao add column if not exists openai_api_key text;
alter table configuracao add exists_gemini_api_key_check text; -- wait, let's use standard column names
alter table configuracao add column if not exists gemini_api_key text;
alter table configuracao add column if not exists ai_provider text default 'gemini';
