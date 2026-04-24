DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'projects' AND policyname = 'projects_select_anon') THEN
    CREATE POLICY projects_select_anon ON public.projects
      FOR SELECT TO anon
      USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'projects' AND policyname = 'projects_insert_anon') THEN
    CREATE POLICY projects_insert_anon ON public.projects
      FOR INSERT TO anon
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tasks' AND policyname = 'tasks_insert_anon') THEN
    CREATE POLICY tasks_insert_anon ON public.tasks
      FOR INSERT TO anon
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tasks' AND policyname = 'tasks_select_anon') THEN
    CREATE POLICY tasks_select_anon ON public.tasks
      FOR SELECT TO anon
      USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'parse_results' AND policyname = 'parse_results_select_anon') THEN
    CREATE POLICY parse_results_select_anon ON public.parse_results
      FOR SELECT TO anon
      USING (true);
  END IF;
END $$;
