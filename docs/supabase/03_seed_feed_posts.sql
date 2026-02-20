-- VDAN Template — seed old homepage posts into feed_posts
-- Run this after:
-- 00_baseline.sql
-- 02_feed_posts.sql

begin;

insert into public.feed_posts (author_id, category, title, body)
values
  (
    '4ec2ca98-39d7-4cc4-97c7-d3b7af94ebcb',
    'termin',
    'Odner Angelfest vom 17.05.2025 bis 18.05.2025',
    'Weitere Termine findest du im Bereich Termine.'
  ),
  (
    '4ec2ca98-39d7-4cc4-97c7-d3b7af94ebcb',
    'info',
    'Vereins News',
    'Auch in diesem Jahr freuen wir uns darüber, unsere langjährigen und engagierten Mitglieder zu ehren.

Vielen Dank für die vergangenen Jahre sowie für die zukünftigen.

Eure Vorstandschaft'
  ),
  (
    '4ec2ca98-39d7-4cc4-97c7-d3b7af94ebcb',
    'arbeitseinsatz',
    'Aktuelle Projekte: Bau von Laichhilfen',
    'Als passionierte Angler und Mitglieder des VDAN-Ottenheim wissen wir, wie wichtig es ist, die Fischbestände in unseren Gewässern zu erhalten und zu schützen. Eine der besten Möglichkeiten dafür ist die Hege und Pflege sowie der Bau von Laichhilfen.

Daher gibt es dank unserer Gewässerwarte immer wieder Arbeitseinsätze zum Bau dieser Laichhilfen.

Unsere Laichhilfen werden aus verschiedenen Materialien hergestellt, zum Beispiel aus Holz, Steinen, Tannen oder Schilfrohr.

Durch den Bau von Laichhilfen können wir die Fischbestände in unseren Gewässern erhöhen, was zu besseren Bedingungen und mehr Erfolg beim Angeln führt.

Insgesamt sind Laichhilfen eine einfache, aber effektive Möglichkeit, um die Fischbestände in unseren Gewässern zu schützen und zu erhöhen.

Als Angelverein sollten wir uns alle bemühen, unser Wissen und unsere Fähigkeiten zu nutzen, um Laichhilfen zu bauen und unseren Beitrag zum Schutz unserer natürlichen Ressourcen zu leisten.'
  );

commit;

