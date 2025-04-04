;; Achievement Certification Contract
;; This contract records completed courses and degrees

;; Define data variables
(define-data-var contract-owner principal tx-sender)
(define-map institutions
  { institution-id: (string-utf8 36) }
  {
    principal: principal,
    name: (string-utf8 100),
    verified: bool
  }
)

(define-map achievements
  {
    achievement-id: (string-utf8 36)
  }
  {
    student-id: (string-utf8 36),
    institution-id: (string-utf8 36),
    achievement-type: (string-utf8 20), ;; "course", "degree", "certificate", etc.
    name: (string-utf8 100),
    description: (string-utf8 500),
    issue-date: uint,
    metadata-url: (optional (string-utf8 256)),
    revoked: bool
  }
)

;; Error codes
(define-constant ERR_UNAUTHORIZED u1)
(define-constant ERR_ALREADY_EXISTS u2)
(define-constant ERR_NOT_FOUND u3)
(define-constant ERR_INVALID_INSTITUTION u4)

;; Read-only functions
(define-read-only (get-institution-info (institution-id (string-utf8 36)))
  (map-get? institutions { institution-id: institution-id })
)

(define-read-only (get-achievement (achievement-id (string-utf8 36)))
  (map-get? achievements { achievement-id: achievement-id })
)

(define-read-only (is-institution-verified (institution-id (string-utf8 36)))
  (default-to false (get verified (get-institution-info institution-id)))
)

;; Public functions
(define-public (register-institution (institution-id (string-utf8 36)) (name (string-utf8 100)))
  (let ((existing-institution (get-institution-info institution-id)))
    (asserts! (is-none existing-institution) (err ERR_ALREADY_EXISTS))

    (map-set institutions
      { institution-id: institution-id }
      {
        principal: tx-sender,
        name: name,
        verified: false
      }
    )
    (ok true)
  )
)

(define-public (verify-institution (institution-id (string-utf8 36)))
  (let ((institution-record (get-institution-info institution-id)))
    ;; Only contract owner can verify institutions
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR_UNAUTHORIZED))
    (asserts! (is-some institution-record) (err ERR_NOT_FOUND))

    (map-set institutions
      { institution-id: institution-id }
      (merge (unwrap-panic institution-record) { verified: true })
    )
    (ok true)
  )
)

(define-public (issue-achievement
    (achievement-id (string-utf8 36))
    (student-id (string-utf8 36))
    (institution-id (string-utf8 36))
    (achievement-type (string-utf8 20))
    (name (string-utf8 100))
    (description (string-utf8 500))
    (metadata-url (optional (string-utf8 256)))
  )
  (let (
      (existing-achievement (get-achievement achievement-id))
      (institution-record (get-institution-info institution-id))
    )
    ;; Ensure achievement doesn't exist already
    (asserts! (is-none existing-achievement) (err ERR_ALREADY_EXISTS))

    ;; Ensure institution exists and is verified
    (asserts! (is-some institution-record) (err ERR_NOT_FOUND))
    (asserts! (is-institution-verified institution-id) (err ERR_INVALID_INSTITUTION))

    ;; Ensure issuer is the institution
    (asserts! (is-eq tx-sender (get principal (unwrap-panic institution-record))) (err ERR_UNAUTHORIZED))

    (map-set achievements
      { achievement-id: achievement-id }
      {
        student-id: student-id,
        institution-id: institution-id,
        achievement-type: achievement-type,
        name: name,
        description: description,
        issue-date: block-height,
        metadata-url: metadata-url,
        revoked: false
      }
    )
    (ok true)
  )
)

(define-public (revoke-achievement (achievement-id (string-utf8 36)))
  (let (
      (achievement-record (get-achievement achievement-id))
    )
    ;; Ensure achievement exists
    (asserts! (is-some achievement-record) (err ERR_NOT_FOUND))

    ;; Get the institution id from the achievement
    (let (
        (achievement (unwrap-panic achievement-record))
        (institution-id (get institution-id achievement))
        (institution-record (get-institution-info institution-id))
      )

      ;; Ensure institution exists
      (asserts! (is-some institution-record) (err ERR_NOT_FOUND))

      ;; Ensure issuer is the institution
      (asserts! (is-eq tx-sender (get principal (unwrap-panic institution-record))) (err ERR_UNAUTHORIZED))

      (map-set achievements
        { achievement-id: achievement-id }
        (merge achievement { revoked: true })
      )
      (ok true)
    )
  )
)
