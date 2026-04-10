let _records = [];

const Store = {
    getRecords: () => _records,
    setRecords: (newRecords) => {
        _records = Array.isArray(newRecords) ? newRecords : [];
    },
    addRecord: (record) => {
        _records.push(record);
    },
    updateRecord: (index, record) => {
        _records[index] = record;
    },
    removeRecordAt: (index) => {
        _records.splice(index, 1);
    },
    popRecord: () => {
        return _records.pop();
    },
    clear: () => {
        _records = [];
    }
};

if (typeof window !== "undefined") {
    window.Store = window.Store || Store;
}
