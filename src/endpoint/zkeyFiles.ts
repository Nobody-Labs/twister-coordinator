import path = require('path');
import express = require('express');

export default express.static(
    path.resolve(__dirname, '..', '..', 'zkeys'),
    {
        index: false,
    }
);