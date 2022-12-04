CREATE TABLE Messages(
    id text PRIMARY KEY,
    message text,
    userId int,
    chatId int,
    date DATE
);
DROP TABLE Messages;

INSERT INTO Messages (message, userId, chatId, date) VALUES
('1', 1, 1, date(1670090951));