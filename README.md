# Presti - Cloud Computing

El presente trabajo, realizado para la materia *Cloud Computing*, consiste en el desarrollo una motor de decisiones para Fintechs que busca mejorar el otorgamiento de productos crediticios (préstamos) a sus clientes minoritas. Para esto, se desarrolló una plataforma cloud que contiene un motor de machine learning que consulta los datos históricos de la *Central de Deudores del BCRA* y predice la situación creditica por los próximos meses.

La plataforma cuenta principalmente con las siguientes funcionalidades representadas en su panel de control:

- <b>Carga y Gestión de Productos</b>: Panel administrativo para que la Fintech gestione de forma directa su catálogo de ofertas financieras (préstmos de distintos montos, plazos, etc.) y les asigne prioridades según sus preferencias comerciales.

- <b>Motor de Simulaciones</b>: Módulo para calcular en tiempo real el scoring de nuevos clientes ingresando su CUIT. Consulta información del BCRA, evalúa al deudor a través de un modelo de Deep Learning (MLP con TensorFlow/Keras) y ofrece recomendaciones inteligentes e instantáneas de productos elegibles.

- <b>Configuración de Parámetros</b>: Sección dedicada a definir los parámetros y reglas globales del negocio de la Fintech (como los umbrales de score mínimo y criterios generales de exclusión) para filtrar automáticamente a solicitantes de alto riesgo.

- <b>Control de Cartera</b>: Monitoreo continuo y centralizado del estado crediticio e historial de deudas de los CUITs en cartera. Permite visualizar tendencias de comportamiento de pagos (mejorando, empeorando o estable) y soporta tanto actualizaciones manuales como automáticas programadas (mediante crons mensuales).

<details>
  <summary>Contenidos</summary>
  <ol>
    <li><a href="#estructura-del-repositorio">Estructura del Repositorio</a></li>
    <li><a href="#guía-de-instalación-y-despliegue">Guía de Instalación y Despliegue</a></li>
    <li><a href="#uso-de-la-aplicación-guía-de-ejecución">Uso de la Aplicación (Guía de Ejecución)</a></li>
    <li><a href="#descripción-de-módulos">Descripción de Módulos</a></li>
    <li><a href="#explicación-de-funciones-y-meta-argumentos">Explicación de Funciones y Meta-Argumentos</a></li>
    <li><a href="#pipeline-de-github-actions-para-terraform">Pipeline de GitHub Actions (Terraform)</a></li>
    <li><a href="#aclaraciones">Aclaraciones</a></li>
    <li><a href="#integrantes">Integrantes</a></li>
  </ol>
</details>

<p align="right">(<a href="#presti---cloud-computing">Volver</a>)</p>

## Estructura del Repositorio:

```
cloud-presti/
├── frontend/               # SPA React + Vite (dashboard fintech)
├── engine/                 # Pipeline Python de training del modelo crediticio
├── backend/                # 14 Lambdas — Node.js (13) + Python (simulations-engine)
├── terraform/              # Stack principal de infra (root module)
│   └── modules/
│       └── network/        # Módulo interno de VPC + subnets + RTs + SGs + endpoints
├── terraform-bootstrap/    # Stack independiente para el state remoto (run una vez)
├── scripts/                # Helpers: bootstrap, deploy, build-engine, build-frontend...
└── .github/
    └── workflows/          # CI (validate) + apply / destroy / bootstrap manuales
```

<p align="right">(<a href="#presti---cloud-computing">Volver</a>)</p>

## Guía de Instalación y Despliegue

Este proyecto está completamente automatizado para ser desplegado y gestionado utilizando **GitHub Actions**. Se deben seguir los siguientes pasos para configurar el repositorio y levantar la infraestructura en AWS:

### Paso 1: Configurar Secretos y Variables en GitHub
Antes de ejecutar cualquier pipeline, se requiere definir los accesos a AWS y el espacio de nombres del stack en la configuración del repositorio de GitHub:

1. Ingresar a **Settings (Configuración) → Secrets and variables → Actions** dentro del repositorio de GitHub.
2. En la pestaña **Secrets** (Secretos), se deben crear los siguientes secretos:
   * `AWS_ACCESS_KEY_ID`: ID de clave de acceso de AWS.
   * `AWS_SECRET_ACCESS_KEY`: Clave de acceso secreta de AWS.
   * `AWS_SESSION_TOKEN`: Token de sesión temporal (necesario si se utiliza AWS Academy o credenciales temporales).
3. En la pestaña **Variables**, se debe crear la siguiente variable:
   * `STACK_NAME`: Nombre único que identificará al stack (por ejemplo, `cloud-presti`). Todos los recursos aprovisionados (buckets S3, tablas DynamoDB, Cognito User Pool, etc.) utilizarán este valor como prefijo para evitar colisiones.

### Paso 2: Ejecutar el Bootstrap
El Bootstrap se encarga de crear el bucket de S3 y la tabla DynamoDB que almacenarán de forma remota y segura el estado de Terraform (`terraform.tfstate`) y gestionarán el bloqueo de concurrencia.
1. Dirigirse a la pestaña **Actions** en GitHub.
2. En la barra lateral izquierda, seleccionar el workflow **Bootstrap Apply**.
3. Hacer clic en **Run workflow** (Ejecutar workflow) seleccionando la rama `main` y presionar el botón verde para confirmar.
4. Esperar a que el pipeline finalice exitosamente. Esto creará el bucket `${STACK_NAME}-state-bucket` y la tabla DynamoDB `${STACK_NAME}-lock-table`.

### Paso 3: Desplegar la Infraestructura y el Frontend
Una vez completado el bootstrap, se puede proceder con el aprovisionamiento de la arquitectura principal y el despliegue del panel de control web.
1. En la pestaña **Actions**, seleccionar el workflow **Terraform Apply**.
2. Hacer clic en **Run workflow**, seleccionar la rama `main` y presionar el botón verde.
3. Este pipeline ejecutará de forma automática los siguientes pasos secuenciales:
   * **Instalación de dependencias**: Se descargan y compilan las dependencias de todas las Lambdas.
   * **Validación y Plan de Terraform**: Se genera y valida de forma estricta el plan de ejecución de infraestructura.
   * **Terraform Apply**: Se aprovisionan de forma segura todos los recursos en la nube de AWS (red VPC, DynamoDB, Lambdas, SQS, API Gateway, Cognito).
   * **Compilación del Frontend**: Se inyectan dinámicamente las variables de entorno producidas por Terraform (como el endpoint de API Gateway y el ID de cliente de Cognito) en un archivo `.env.production` en React.
   * **Despliegue Web**: Se compila la SPA de React y se sincronizan los archivos construidos con el bucket S3 de hosting web.
4. Al finalizar, en la salida del workflow o en los outputs de Terraform se podrán encontrar el endpoint de API Gateway y la URL pública de la aplicación para comenzar con su utilización.

---

### Mantenimiento y Destrucción del Stack (Opcional)
En caso de requerir la limpieza y eliminación completa de toda la infraestructura creada para evitar costos continuos:
1. En la pestaña **Actions**, seleccionar el workflow **Terraform Destroy**.
2. Hacer clic en **Run workflow**.
3. En el campo de confirmación requerido, escribir exactamente la palabra `destroy`.
4. Presionar el botón verde de ejecución. El pipeline vaciará de manera segura el bucket S3 del frontend y destruirá absolutamente todos los recursos de AWS asociados al stack.

<p align="right">(<a href="#presti---cloud-computing">Volver</a>)</p>

## Uso de la Aplicación (Guía de Ejecución)

A continuación se detalla la guía paso a paso para la ejecución de los flujos de negocio clave desde la perspectiva del usuario de la plataforma:

### 1. Registro y Autenticación
1. **Acceso al Portal**: Al ingresar a la URL pública de la aplicación, el usuario selecciona la opción de registrarse para crear una nueva cuenta.
2. **Formulario de Registro**: Es redirigido de forma segura a la pantalla de registro, donde se solicita ingresar una contraseña segura que cumpla con los estándares requeridos (mayúsculas, minúsculas, números y longitud mínima).
3. **Confirmación**: Se envía de manera automática un código de confirmación a la dirección de correo electrónico provista.
4. **Validación de la Cuenta**: Al ingresar el código recibido, la cuenta queda activa y configurada de forma inmediata con los parámetros generales y reglas de negocio por defecto para la Fintech.

### 2. Configuración de Parámetros Generales
Desde la pestaña **Parámetros**, la Fintech establece las reglas de exclusión automática que se evaluarán para cada solicitante antes de procesar el modelo de Machine Learning.
* **Parámetros configurables**:
  * **Situación Crediticia Máxima**: Calificación máxima admitida en las centrales de deudores (por defecto, situación 2).
  * **Límite de Entidades Financieras**: Cantidad máxima permitida de acreedores con deudas vigentes.
  * **Deuda Máxima Permitida**: Límite total en pesos del monto consolidado de deudas del solicitante.
  * **Historial Limpio Requerido**: Cantidad de meses mínimos consecutivos que se le exige al cliente estar en excelente situación de pago (Situación 1).
  * **Días de Atraso Máximos**: Tolerancia máxima en días para atrasos en sus pagos vigentes.
  * **Procesos Judiciales**: Exclusión automática si el solicitante posee algún proceso legal o juicio financiero activo.
* **Aplicación de Cambios**: Cualquier cambio realizado en esta sección se guarda al instante y comenzará a aplicar para las evaluaciones futuras.

### 3. Alta de Productos Financieros
Para poder generar recomendaciones inteligentes, la Fintech debe construir su catálogo de ofertas disponibles. Desde la sección **Productos → Nuevo producto**, se configuran los siguientes campos:
* **Detalle del Producto**: Nombre descriptivo, Monto, Plazo (cantidad de cuotas), Tasa de interés anual y Prioridad comercial (peso de 1 a 10 para ponderar su visualización ante el cliente).
* **Restricción de Scoring**: Rango de score de elegibilidad (en escala de 0.0 a 10.0) que se le exige al solicitante para calificar a esta oferta.
* **Catálogo Activo**: Al crearse, el producto queda disponible para ser recomendado dinámicamente si el solicitante cumple con la puntuación requerida.

### 4. Ejecución de una Simulación
Para evaluar el riesgo crediticio de un nuevo cliente y recibir recomendaciones en tiempo real:
1. **Iniciar Evaluación**: En la sección **Simulaciones → Nueva simulación**, el usuario introduce el CUIT del solicitante.
2. **Evaluación de Filtros**: El sistema consulta automáticamente el historial crediticio del CUIT en la central de deudores y aplica los filtros definidos en la *Configuración de Parámetros*. Si no los cumple, la simulación se marca como **Rechazada** (especificando con precisión qué regla de negocio falló).
3. **Cálculo de Score**: Si supera exitosamente los filtros de exclusión, un modelo de inteligencia artificial de última generación analiza el perfil crediticio para determinar un puntaje de riesgo preciso.
4. **Estados del Proceso**:
   * *En proceso*: Analizando los antecedentes financieros y corriendo filtros.
   * *Completada*: Simulación finalizada con éxito con un score y recomendaciones calculadas.
   * *Rechazada*: Evaluada pero descartada por incumplir alguna política comercial.

### 5. Consulta de Recomendaciones
Cuando la simulación finaliza con estado **Completada**, el usuario puede ingresar al detalle para visualizar el análisis completo:
1. **Score Obtenido**: Se expone el puntaje final del solicitante (escala de 0.0 a 10.0).
2. **Ofertas Personalizadas**:
   * **Productos Elegibles**: Lista de los créditos para los cuales el cliente califica según su puntaje de riesgo, ordenados de forma descendente por la prioridad comercial de la Fintech.
   * **Productos No Elegibles**: Aquellos productos que no cumplen con los límites de score del deudor, especificando el motivo del descarte (si está por debajo o por encima del score requerido).

### 6. Control y Monitoreo de Cartera (Portfolio)
La sección de **Cartera** sirve como un centro de control unificado del comportamiento de pago de todos los clientes que han sido evaluados históricamente por la Fintech:
* **Vista General**: Muestra el listado de CUITs consultados junto con su situación crediticia actual, su estado histórico anterior y una clara tendencia visual de comportamiento financiero (si está mejorando, empeorando o se mantiene estable).
* **Actualización Periódica**: La información crediticia de la cartera se actualiza automáticamente todos los meses de forma programada y transparente.
* **Actualización Bajo Demanda**: El usuario puede presionar el botón "Actualizar cartera" en el dashboard para forzar una sincronización manual e inmediata de todos los registros de deudores con el fin de ver reflejados los datos actualizados al instante.

<p align="right">(<a href="#presti---cloud-computing">Volver</a>)</p>

## Descripción de Módulos

El proyecto se estructura bajo un enfoque modular, limpio y escalable con las siguientes definiciones de infraestructura en Terraform:

### 1. Módulo Raíz (`terraform/`)
Es el punto de entrada y composición arquitectónica del proyecto. Orquesta y compone la infraestructura global:
* Declara la red mediante la invocación del módulo local `network`.
* Configura los recursos del Core de AWS: 5 tablas de DynamoDB (a través del módulo del registry oficial), la cola SQS principal y su DLQ, las 14 Lambdas del backend, la API HTTP de API Gateway, el User Pool de Cognito, Secrets Manager para el resguardo seguro del client secret, y el S3 que sirve el frontend estático.
* Centraliza en `locals.tf` todos los diccionarios y colecciones (`lambda_sources`, `lambda_configs`, `lambda_permissions`, `api_integrations`, `api_routes`) para alimentar los recursos iterativamente, reduciendo la duplicación y el hardcoding.
* Configura alarmas de CloudWatch (`alarms.tf`) basadas en métricas sobre fallas en Lambdas críticas y la presencia de mensajes en la DLQ.

### 2. Módulo Interno de Red (`terraform/modules/network/`)
Módulo local reutilizable que encapsula el aprovisionamiento de la VPC y el plano de red seguro:
* **Entradas Declarativas**: Recibe configuraciones en variables de tipo objeto (`vpc_config`, `subnets_config`, `route_tables_config`, `security_groups_config`, `vpc_endpoints_config`).
* **Aislamiento**: Crea subnets públicas (para NAT Gateways e Internet Gateway) y privadas (para Lambdas en VPC).
* **Seguridad y Endpoints**: Implementa Security Groups con soporte para referencias cruzadas (por ejemplo, permitir tráfico únicamente del Security Group de Lambdas hacia los VPC Interface Endpoints).
* **VPC Endpoints**: Crea endpoints de tipo **Gateway** para S3 y DynamoDB (evitando el tráfico a través de internet) y de tipo **Interface** para SQS en las subnets privadas.

### 3. Módulo Público de DynamoDB (`terraform-aws-modules/dynamodb-table/aws` v4.4.0)
Módulo del registry oficial instanciado **5 veces** para proveer persistencia aislada a nivel de tabla bajo demanda (`billing_mode = PAY_PER_REQUEST`):
1. **`dynamodb_simulations`** (`${stack_name}-simulations`):
   * Hash key: `sub` | Range key: `sk`.
   * **GSI `task-id-sub-index`**: Indexa `task_id` (Hash) y `sub` (Range). Permite a `recommendations-get` y `simulations-results` buscar directamente por el ID de la tarea de forma sumamente rápida, garantizando aislamiento multi-inquilino.
2. **`dynamodb_fintech`** (`${stack_name}-fintech`):
   * Hash key: `sub` (parámetros globales de la Fintech).
3. **`dynamodb_product`** (`${stack_name}-product`):
   * Hash key: `sub` | Range key: `product_id` (catálogo de créditos de la Fintech).
4. **`dynamodb_user`** (`${stack_name}-user`):
   * Hash key: `sub` | Range key: `cuit` (vínculo entre Fintech y CUITs consultados).
5. **`dynamodb_portfolio`** (`${stack_name}-portfolio`):
   * Hash key: `pk` | Range key: `sk`.
   * **GSI `gsi1`**: Indexa `gsi1_pk` y `gsi1_sk` para la resolución inversa Fintech -> CUIT.
   * **Sparse GSI `record-type-pk-index`**: Indexa `record_type` (Hash) y `pk` (Range). Al ser sparse, solo almacena ítems del tipo `INFO`, lo que permite al actualizador mensual iterar únicamente los CUITs de forma ágil y barata sin incurrir en `Scan` globales costosos sobre registros de control.

### 4. Stack de Bootstrap (`terraform-bootstrap/`)
Un stack independiente y aislado cuyo único objetivo es la creación de los recursos de soporte para la ejecución remota de Terraform:
* Un bucket S3 con encriptación AES256, versionado activo y bloqueo estricto de acceso público para almacenar el backend state de Terraform de forma segura.
* Una tabla de DynamoDB para el control de concurrencia y bloqueo de estado (`LockTable`), previniendo colisiones en despliegues concurrentes.

<p align="right">(<a href="#presti---cloud-computing">Volver</a>)</p>

## Explicación de Funciones y Meta-Argumentos

El diseño de la infraestructura en Terraform utiliza avanzadas metodologías de programación declarativa y validaciones rigurosas:

### 1. Meta-Argumentos Utilizados
* **`for_each`**: Es el motor de la iteración. Evita la duplicación masiva de código instanciando múltiples recursos dinámicamente. Se utiliza para:
  * Las 13 Lambdas del Core y sus configuraciones detalladas.
  * Los 14 grupos de logs en CloudWatch (asegurando el ciclo de vida coordinado con cada función).
  * Los permisos de invocación y mapeo de triggers.
  * La creación modular de las 5 tablas DynamoDB.
  * La definición de subnets, tablas de ruteo, reglas de seguridad y endpoints en el módulo `network`.
  * La asignación de alarmas de CloudWatch para métricas de error.
* **`dynamic`**: Utilizado para inyectar bloques configurativos anidados condicionalmente. En `aws_lambda_function.lambdas`, se aplica en:
  * `vpc_config`: Inyecta la red únicamente a las Lambdas que tienen configurado `in_vpc = true`.
  * `dead_letter_config`: Asocia la DLQ solo a aquellas Lambdas asíncronas registradas para opt-in en `local.lambda_async_dlq_arns`.
* **`lifecycle` y `precondition`**: Bloques para definir políticas de ciclo de vida e invariantes de negocio/arquitectura que detienen tempranamente la ejecución antes de causar inconsistencias en AWS:
  * **En `aws_route`**: Valida que si una ruta apunta a un target `nat`, la tabla de ruteo solo contenga subnets de una única Zona de Disponibilidad (AZ) y que exista un NAT Gateway aprovisionado en dicha AZ.
  * **En `aws_vpc_endpoint`**: Exige que el tipo sea "Gateway" o "Interface", validando que los endpoints Gateway tengan tablas de ruteo asociadas y que los endpoints Interface tengan subnets asociadas.
* **`depends_on`**: Declara dependencias de orden explícitas. Garantiza que los `aws_cloudwatch_log_group.lambdas` se creen estrictamente antes que las `aws_lambda_function` (previniendo que las Lambdas auto-generen grupos sin retención que hinchen el presupuesto), y que el build del frontend (`terraform_data.build_frontend`) comience recién cuando Cognito, la API y S3 estén listos.
* **`provider`**: Permite definir múltiples configuraciones. Se utiliza a nivel root con el bloque `default_tags` para propagar automáticamente tags globales (`Project`, `Environment`, `ManagedBy`, `Repository`) a todo recurso que soporte etiquetado en AWS.

### 2. Funciones de Terraform Empleadas
* **`flatten()`**: Aplana listas anidadas de objetos en una colección lineal. Esencial para iterar colecciones complejas como la de permisos de Lambdas (`local.lambda_permissions`) o las reglas complejas de ruteo y security groups en el módulo de red.
* **`for ... in ...`**: Comprensión sintáctica para construir mapas y listas filtradas o transformadas en tiempo real. Por ejemplo: `[for cidr in var.private_subnet_cidrs : module.vpc.subnet_ids[cidr]]` para mapear los rangos CIDR a IDs de subnets reales provistos por el módulo de red.
* **`concat()`**: Combina múltiples listas en una sola. Usado para agrupar el set de Lambdas regulares y la Lambda especial `auth-callback` en una lista consolidada para los CloudWatch Log Groups.
* **`lookup()`**: Busca una clave en un mapa de forma segura, retornando un valor por defecto si no existe (por ejemplo, resolver los DLQ ARNs opt-in sin arrojar errores de referencia nula).
* **`jsonencode()`**: Serializa objetos y estructuras de datos nativas de Terraform a strings JSON válidos. Usado para empaquetar la bucket policy del frontend de S3 y el `redrive_policy` de la cola SQS.
* **`filemd5()`**: Calcula el hash MD5 del script de despliegue del frontend, utilizándolo dentro de los triggers de reemplazo en `terraform_data` para forzar un rebuild automático y sincronización a S3 solo cuando el script o configuraciones clave varían.
* **`length()`, `contains()`, `keys()`, `distinct()`, `toset()`**: Utilidades nativas de manipulación y validación de colecciones para verificar condiciones de ruteo y saneamiento de variables.

### 3. Otros Recursos Destacados
* **`data "archive_file"`**: Empaqueta el código de cada Lambda en archivos ZIP al vuelo durante el ciclo del plan/apply. El cálculo nativo de su `source_code_hash` permite que Terraform detecte cambios en el código de NodeJS/Python y redespliegue únicamente las Lambdas modificadas.
* **`data "aws_iam_role"`**: Referencia y consume el rol preexistente `LabRole` provisto por AWS Academy, necesario por las severas restricciones del entorno educativo.
* **`aws_cloudwatch_log_group`**: Declara explícitamente los grupos de logs para configurar una retención estricta de 7 días, previniendo costos descontrolados por retención indefinida (default de AWS).

<p align="right">(<a href="#presti---cloud-computing">Volver</a>)</p>

## Pipeline de GitHub Actions (Terraform)

El proyecto cuenta con un esquema de Integración Continua (CI) robusto que automatiza las tareas de aseguramiento de calidad del código de infraestructura en cada cambio.

### 1. Validación de Infraestructura en CI (`ci.yml`)
Cada vez que se sube código o se genera un Pull Request, se ejecuta el workflow de validación. Este workflow realiza pruebas de sintaxis, formato y coherencia arquitectónica **sin inicializar recursos en AWS (`-backend=false`)** para actuar de forma sumamente rápida:

```yaml
jobs:
  terraform:
    name: Terraform
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: "~1.9"
          terraform_wrapper: false

      - name: Terraform Init
        run: terraform init -backend=false
        working-directory: terraform

      - name: Terraform Format Check
        run: terraform fmt -check -recursive
        working-directory: terraform
        continue-on-error: true

      - name: Terraform Validate
        run: terraform validate
        working-directory: terraform
```

El mismo job se ejecuta en paralelo para el stack de **bootstrap** (`terraform-bootstrap/`) y para el módulo aislado de **red** (`terraform/modules/network/`), garantizando que cualquier error de sintaxis o rotura interna de variables en el módulo modularizado sea detectado de inmediato.

### 2. Pipeline de Despliegue con Plan Guardado (`terraform-apply.yml`)
Para los despliegues formales en la rama principal (`main`), el pipeline de ejecución remota de Terraform implementa las mejores prácticas de infraestructura como código (IaC):
1. **Inicialización (`terraform init`)**: Se conecta al backend de S3 remoto configurando los locks en DynamoDB.
2. **Validación y Chequeo de Formato (`validate` y `fmt`)**: Valida la integridad del código.
3. **Plan Guardado (`terraform plan -out=tfplan`)**: Genera el plan de ejecución y lo persiste en un archivo físico binario (`tfplan`). Esto garantiza que los cambios planificados y auditados sean **exactamente los mismos** que se aplicarán en el paso posterior, mitigando problemas por drifts de estado de último segundo.
4. **Aplicación del Plan (`terraform apply tfplan`)**: Ejecuta los cambios de manera directa y predecible.

```yaml
      - name: Terraform Init
        run: bash scripts/terraform-init.sh

      - name: Terraform Format Check
        run: terraform fmt -check -recursive
        working-directory: terraform
        continue-on-error: true

      - name: Terraform Validate
        run: terraform validate
        working-directory: terraform

      - name: Terraform Plan
        run: terraform plan -no-color -out=tfplan
        working-directory: terraform

      - name: Terraform Apply
        if: github.ref == 'refs/heads/main'
        run: terraform apply tfplan
        working-directory: terraform
```

<p align="right">(<a href="#presti---cloud-computing">Volver</a>)</p>

## Aclaraciones

Algunas aclaraciones finales con respecto a las funcionalidades de este trabajo:
- <b>API BCRA</b>: La funcionalidad de la API provista por el BCRA no es consistente, algunas veces las request logran llegar a destino y se obtiene una respuesta, pero otras no. Se intentó de distintas formas y con distintos headers, y se dejó funcionando la configuración que mejores resultados arrojó.
- <b>Funcionalidad de Simulación</b>: Actualmente, las simulaciones arrojan la predición del score obtenida del modelo, y en base a los productos del usuario se realiza el cálculo en el frontend. La idea es para el TP4 que la simulación devuelva directamente los productos recomendados.
- <b>Funcionalidad como API</b>: Si bien se pretende que el sistema provea una API que las Fintech puedan integrar para aplicar las funcionalidades, esta feature se implementará en el TP4.

<p align="right">(<a href="#presti---cloud-computing">Volver</a>)</p>

## Integrantes:

Barnatán, Martín Alejandro (64463) - mbarnatan@itba.edu.ar

Gonzalez Cornet, Josefina (64550) - jgonzalezcornet@itba.edu.ar

Hillar, Conrado (64633) - chillar@itba.edu.ar

Maruottolo Quiroga, Ignacio Martín (64611) - imaruottoloquiroga@itba.edu.ar

Ignacio Pedemonte Berthoud (64908) - ipedemonteberthoud@itba.edu.ar

Thomas, Philippe (69250) - phthomas@itba.edu.ar

<p align="right">(<a href="#presti---cloud-computing">Volver</a>)</p>