# Changelog

All changes to this plugin are listed here.

## 0.5.0 (2023-07-01)

### New

- #8 Add a **from** parameter.

## 0.4.0 (2023-06-09)

### New

- #4 Body can be set after the yaml, seperated by a "---" line

## 0.3.3 (2023-03-06)

### Fixed

- #2 only add `&cc`, `&bcc` or `&body` if a value is provided

## 0.3.2 (2023-01-13)

### Fixed

- Use `"""` for second parameter in `getFirstLinkpathDest` if absolute path  

## 0.3.1 (2023-01-12)

### Fixed

- Use `ctx.sourcePath` for finding the correct frontmatter data of the file
- Use `ctx.sourcePath` in `getFirstLinkpathDest` to make sure finding the correct linked file

## 0.3.0 (2023-01-04)

### New

- Add placeholder variables

## 0.2.0 (2022-12-30)

### New

- A note can be used as body content using an internal link.

## 0.1.1 (2022-12-28)

### Changed

- Use obsidian parseYaml

## 0.1.0 (2022-12-17)

### Added

- Base functionality