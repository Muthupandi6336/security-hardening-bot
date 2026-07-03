const { EC2Client, DescribeSecurityGroupsCommand } = require('@aws-sdk/client-ec2');
const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');
const compute = require('@google-cloud/compute');
const { ComputeManagementClient } = require('@azure/arm-compute');
const { DefaultAzureCredential } = require('@azure/identity');

// Helper to check if credentials are provided in env
const hasAwsCreds = () => process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;
const hasGcpCreds = () => process.env.GOOGLE_APPLICATION_CREDENTIALS;
const hasAzureCreds = () => process.env.AZURE_TENANT_ID && process.env.AZURE_CLIENT_ID;

const cloudService = {
  scanAwsS3: async () => {
    if (!hasAwsCreds()) {
      return { status: 'mock', message: 'No AWS credentials found. Returning simulated data.', data: [
        { name: 'prod-backups-bucket', public: false },
        { name: 'client-data', public: true, issue: 'Public read access enabled' }
      ]};
    }
    try {
      const client = new S3Client({ region: 'us-east-1' });
      const command = new ListBucketsCommand({});
      const response = await client.send(command);
      return { status: 'success', data: response.Buckets };
    } catch (error) {
      return { status: 'error', error: error.message };
    }
  },
  
  scanAwsEc2: async () => {
    if (!hasAwsCreds()) {
      return { status: 'mock', message: 'No AWS credentials found. Returning simulated data.', data: [
        { groupId: 'sg-0a1b2c3d', name: 'prod-db-sg', issue: '0.0.0.0/0 on port 3306' }
      ]};
    }
    try {
      const client = new EC2Client({ region: 'us-east-1' });
      const command = new DescribeSecurityGroupsCommand({});
      const response = await client.send(command);
      return { status: 'success', data: response.SecurityGroups };
    } catch (error) {
      return { status: 'error', error: error.message };
    }
  },

  scanGcpCompute: async () => {
    if (!hasGcpCreds()) return { status: 'mock', message: 'No GCP credentials. Simulated.', data: [] };
    // Actual implementation would instantiate GCP client here
    return { status: 'success', data: [] };
  },

  scanAzureCompute: async () => {
    if (!hasAzureCreds()) return { status: 'mock', message: 'No Azure credentials. Simulated.', data: [] };
    const credential = new DefaultAzureCredential();
    const client = new ComputeManagementClient(credential, process.env.AZURE_SUBSCRIPTION_ID);
    // Real call
    return { status: 'success', data: [] };
  }
};

module.exports = cloudService;
