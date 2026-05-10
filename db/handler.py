import subprocess
import os
import json
import boto3


def handler(event, context):
    sm = boto3.client("secretsmanager", region_name="us-east-1")
    secret = sm.get_secret_value(SecretId=os.environ["SECRET_ARN"])
    creds = json.loads(secret["SecretString"])

    result = subprocess.run(
        [
            "flyway",
            f"-url=jdbc:postgresql://{os.environ['DB_HOST']}:{os.environ['DB_PORT']}/{os.environ['DB_NAME']}",
            f"-user={creds['username']}",
            f"-password={creds['password']}",
            "-locations=filesystem:/var/task/migrations",
            "migrate",
        ],
        capture_output=True,
        text=True,
        timeout=300,
    )

    print("STDOUT:", result.stdout)
    print("STDERR:", result.stderr)

    if result.returncode != 0:
        raise Exception(f"Flyway migration failed:\n{result.stderr}")

    return {"statusCode": 200, "body": result.stdout}
