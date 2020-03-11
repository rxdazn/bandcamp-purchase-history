FILES = manifest.json popup.html popup.js background.js
VERSION = `python -c "import json; print(json.load(open('manifest.json'))['version'])"`
TARGET = bandcamp-purchase-history-$(VERSION).zip

zip:
	-rm -f $(TARGET)
	zip -r $(TARGET) $(FILES)
	@echo 
	@echo "Did you remember to bump the version number? ... " $(VERSION)
