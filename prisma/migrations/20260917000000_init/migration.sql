-- CreateTable
CREATE TABLE `images` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `path` VARCHAR(512) NOT NULL,
    `hash` VARCHAR(64) NOT NULL,
    `file_size` BIGINT NOT NULL,
    `mtime` BIGINT NOT NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `ocr_text` LONGTEXT NOT NULL,
    `confidence` DOUBLE NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `images_path_key`(`path`),
    FULLTEXT INDEX `idx_ocr_text`(`ocr_text`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
