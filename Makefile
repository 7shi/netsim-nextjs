TARGET = out/index-cdn.html
LATEST_TAG := $(shell git describe --tags --abbrev=0)
URL = https://cdn.jsdelivr.net/gh/7shi/netsim-nextjs@$(LATEST_TAG)

all: $(TARGET)

$(TARGET): out/index.html
	python conv-cdn.py $< | sed 's|/_next/|$(URL)/out/_next/|g' > $@

dev:
	npm run dev

build:
	npx next build

clean:
	rm -f $(TARGET)

.PHONY: all dev build clean
