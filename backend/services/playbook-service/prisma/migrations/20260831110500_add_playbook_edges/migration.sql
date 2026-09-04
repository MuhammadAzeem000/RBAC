-- AlterTable
ALTER TABLE "playbook_versions" ADD COLUMN     "edges" JSON NOT NULL DEFAULT '[]';
