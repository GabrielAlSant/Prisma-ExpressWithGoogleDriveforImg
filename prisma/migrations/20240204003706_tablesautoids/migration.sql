-- AlterTable
CREATE SEQUENCE friend_id_seq;
ALTER TABLE "Friend" ALTER COLUMN "id" SET DEFAULT nextval('friend_id_seq');
ALTER SEQUENCE friend_id_seq OWNED BY "Friend"."id";

-- AlterTable
CREATE SEQUENCE invite_id_seq;
ALTER TABLE "Invite" ALTER COLUMN "id" SET DEFAULT nextval('invite_id_seq');
ALTER SEQUENCE invite_id_seq OWNED BY "Invite"."id";
