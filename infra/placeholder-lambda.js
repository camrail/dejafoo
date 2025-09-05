exports.handler = async (event) => {
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: 'Placeholder Lambda function - will be replaced by CodeBuild',
            timestamp: new Date().toISOString()
        })
    };
};
